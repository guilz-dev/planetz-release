import type {
  EnqueueTaskResult,
  GitHubIssueErrorCode,
  GitHubIssueListItem,
  GitHubIssueView,
  WorkflowMode,
} from '@planetz/shared'
import {
  buildIssueTaskDraft,
  buildIssueTaskTitle,
  extractGitHubIssueErrorCode,
  formatIssueRefKey,
} from '@planetz/shared'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type TranslateFn, useI18n } from '../i18n'
import {
  issueTaskActivityForRef,
  useIssueTaskActivityIndex,
  useWorkspaceTasks,
} from '../lib/issue-task-activity.js'
import { ollamaGuardWarnMessageForDraft } from '../lib/ollama-guard-warn.js'
import { toErrorMessage } from '../lib/to-error-message.js'
import { useAppStore } from '../store/app-store.js'
import type { ConfirmDialogRequest } from './use-confirm-dialog.js'
import { usePushToast } from './use-toast.js'

async function maybeToastOllamaGuardWarn(
  draft: string,
  workflow: string,
  recentWorkflowNames: string[],
  pushToast: ReturnType<typeof usePushToast>,
  t: TranslateFn,
): Promise<void> {
  const warnMessage = await ollamaGuardWarnMessageForDraft(
    { body: draft, workflowMode: 'manual', workflow },
    recentWorkflowNames,
    t,
  )
  if (!warnMessage) return
  pushToast({
    kind: 'warn',
    title: t('composer.ollamaGuardWarn.title'),
    message: warnMessage,
  })
}

export function useIssueTabActions(
  recentWorkflowNames: string[],
  options: {
    requestConfirm: (req: ConfirmDialogRequest) => Promise<boolean>
    getEnqueueExtras?: () => Partial<Parameters<typeof window.orbit.enqueueTask>[0]>
    /** When false, auto enqueue is blocked (e.g. low-confidence gate). */
    prepareBeforeAutoEnqueue?: (input: { draft: string; title: string }) => Promise<boolean>
  },
) {
  const { requestConfirm } = options
  const { t } = useI18n()
  const pushToast = usePushToast()
  const selectedWorkflow = useAppStore((s) => s.selectedWorkflow)
  const workflowMode = useAppStore((s) => s.workflowMode)
  const pushRecentWorkflow = useAppStore((s) => s.pushRecentWorkflow)
  const setLastAutoDecision = useAppStore((s) => s.setLastAutoDecision)
  const setPromptHistory = useAppStore((s) => s.setPromptHistory)
  const tasks = useWorkspaceTasks()
  const promptHistory = useAppStore((s) => s.promptHistory)
  const activityIndex = useIssueTaskActivityIndex(tasks, promptHistory)

  const refreshPromptHistory = useCallback(async () => {
    const items = await window.orbit.listPromptHistory({ limit: 20 })
    setPromptHistory(items)
  }, [setPromptHistory])

  const listRequestGenerationRef = useRef(0)
  const issueRequestGenerationRef = useRef(0)

  const [pages, setPages] = useState<
    Array<{
      items: GitHubIssueListItem[]
      pageInfo: { endCursor: string | null; hasNextPage: boolean }
    }>
  >([])
  const [pageIndex, setPageIndex] = useState(0)
  const [listErrorCode, setListErrorCode] = useState<GitHubIssueErrorCode | null>(null)
  const [listErrorDetail, setListErrorDetail] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)

  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null)
  const [issue, setIssue] = useState<GitHubIssueView | null>(null)
  const [issueErrorCode, setIssueErrorCode] = useState<GitHubIssueErrorCode | null>(null)
  const [issueErrorDetail, setIssueErrorDetail] = useState<string | null>(null)
  const [issueLoading, setIssueLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  const currentPage = pages[pageIndex] ?? null
  const issueList = currentPage?.items ?? []
  const canGoPrev = pageIndex > 0
  const canGoNext =
    pageIndex < pages.length - 1 ||
    (currentPage?.pageInfo.hasNextPage === true && Boolean(currentPage.pageInfo.endCursor))

  const selectedIssueListItem = useMemo(
    () => issueList.find((item) => item.number === selectedIssueNumber) ?? null,
    [issueList, selectedIssueNumber],
  )

  const bumpListRequestGeneration = useCallback(() => {
    listRequestGenerationRef.current += 1
    return listRequestGenerationRef.current
  }, [])

  const invalidateIssueDetailRequests = useCallback(() => {
    issueRequestGenerationRef.current += 1
    setSelectedIssueNumber(null)
    setIssue(null)
    setIssueErrorCode(null)
    setIssueErrorDetail(null)
    setIssueLoading(false)
  }, [])

  const fetchOpenIssues = useCallback(async (after?: string) => {
    return window.orbit.listOpenGitHubIssues(after ? { after } : undefined)
  }, [])

  const loadFirstPage = useCallback(async () => {
    const generation = bumpListRequestGeneration()
    invalidateIssueDetailRequests()
    setListLoading(true)
    setListErrorCode(null)
    setListErrorDetail(null)
    try {
      const firstPage = await fetchOpenIssues()
      if (generation !== listRequestGenerationRef.current) return
      setPages([{ items: firstPage.items, pageInfo: firstPage.pageInfo }])
      setPageIndex(0)
    } catch (error) {
      if (generation !== listRequestGenerationRef.current) return
      const code = extractGitHubIssueErrorCode(error)
      setListErrorCode(code ?? 'unexpected_failure')
      setListErrorDetail(toErrorMessage(error, t('views.issue.errors.unexpected_failure')))
      setPages([])
      setPageIndex(0)
    } finally {
      if (generation === listRequestGenerationRef.current) {
        setListLoading(false)
      }
    }
  }, [bumpListRequestGeneration, fetchOpenIssues, invalidateIssueDetailRequests, t])

  const goPrevPage = useCallback(() => {
    if (!canGoPrev || listLoading) return
    bumpListRequestGeneration()
    invalidateIssueDetailRequests()
    setPageIndex((current) => Math.max(0, current - 1))
  }, [bumpListRequestGeneration, canGoPrev, invalidateIssueDetailRequests, listLoading])

  const goNextPage = useCallback(async () => {
    if (!canGoNext || listLoading || !currentPage) return
    if (pageIndex < pages.length - 1) {
      bumpListRequestGeneration()
      invalidateIssueDetailRequests()
      setPageIndex((current) => current + 1)
      return
    }
    if (!currentPage.pageInfo.endCursor) return

    const generation = bumpListRequestGeneration()
    invalidateIssueDetailRequests()
    setListLoading(true)
    setListErrorCode(null)
    setListErrorDetail(null)
    try {
      const nextPage = await fetchOpenIssues(currentPage.pageInfo.endCursor)
      if (generation !== listRequestGenerationRef.current) return
      const mergedPages = [...pages, { items: nextPage.items, pageInfo: nextPage.pageInfo }]
      setPages(mergedPages)
      setPageIndex(mergedPages.length - 1)
    } catch (error) {
      if (generation !== listRequestGenerationRef.current) return
      const code = extractGitHubIssueErrorCode(error)
      setListErrorCode(code ?? 'unexpected_failure')
      setListErrorDetail(toErrorMessage(error, t('views.issue.errors.unexpected_failure')))
    } finally {
      if (generation === listRequestGenerationRef.current) {
        setListLoading(false)
      }
    }
  }, [
    bumpListRequestGeneration,
    canGoNext,
    currentPage,
    fetchOpenIssues,
    invalidateIssueDetailRequests,
    listLoading,
    pageIndex,
    pages,
    t,
  ])

  const selectIssue = useCallback(
    async (item: GitHubIssueListItem) => {
      const generation = ++issueRequestGenerationRef.current
      setSelectedIssueNumber(item.number)
      setIssueLoading(true)
      setIssueErrorCode(null)
      setIssueErrorDetail(null)
      setIssue(null)
      try {
        const fetched = await window.orbit.fetchGitHubIssue({
          ref: `${item.repository.owner}/${item.repository.name}#${item.number}`,
        })
        if (generation !== issueRequestGenerationRef.current) return
        setIssue(fetched)
      } catch (error) {
        if (generation !== issueRequestGenerationRef.current) return
        const code = extractGitHubIssueErrorCode(error)
        setIssueErrorCode(code ?? 'unexpected_failure')
        setIssueErrorDetail(toErrorMessage(error, t('views.issue.errors.unexpected_failure')))
      } finally {
        if (generation === issueRequestGenerationRef.current) {
          setIssueLoading(false)
        }
      }
    },
    [t],
  )

  const performEnqueue = useCallback(
    async (
      draft: string,
      targetIssue: GitHubIssueView,
      mode: WorkflowMode,
    ): Promise<EnqueueTaskResult | undefined> => {
      const workflow = selectedWorkflow.trim()
      if (mode === 'manual' && !workflow) return undefined

      if (mode === 'manual') {
        await maybeToastOllamaGuardWarn(draft, workflow, recentWorkflowNames, pushToast, t)
      }

      try {
        const result = await window.orbit.enqueueTask({
          title: buildIssueTaskTitle(targetIssue),
          body: draft,
          issueRef: formatIssueRefKey(targetIssue.repository, targetIssue.number),
          issueNumber: targetIssue.number,
          workflowMode: mode,
          ...(mode === 'manual' ? { workflow } : {}),
          recentWorkflowNames,
          ...(options.getEnqueueExtras?.() ?? {}),
        })
        void refreshPromptHistory().catch(() => undefined)
        if (mode === 'manual') {
          pushRecentWorkflow(workflow)
        } else if (result.autoDecision) {
          setLastAutoDecision(result.autoDecision)
          pushRecentWorkflow(result.autoDecision.selectedWorkflow)
        }
        pushToast({
          kind: 'success',
          title: t('views.issue.toast.enqueued.title'),
          message: t('views.issue.toast.enqueued.message'),
        })
        return result
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('views.issue.toast.enqueueFailed.title'),
          message: toErrorMessage(error, t('views.issue.toast.enqueueFailed.message')),
        })
        throw error
      }
    },
    [
      pushRecentWorkflow,
      pushToast,
      recentWorkflowNames,
      refreshPromptHistory,
      selectedWorkflow,
      setLastAutoDecision,
      options,
      t,
    ],
  )

  const confirmIfIssueRunning = useCallback(
    async (targetIssue: GitHubIssueView): Promise<boolean> => {
      const activity = issueTaskActivityForRef(
        activityIndex,
        targetIssue.repository,
        targetIssue.number,
      )
      if (activity.runningCount <= 0) return true
      const ref = formatIssueRefKey(targetIssue.repository, targetIssue.number)
      return requestConfirm({
        title: t('views.issue.confirm.duplicate.title'),
        message: t('views.issue.confirm.duplicate.message', { ref }),
        confirmLabel: t('views.issue.confirm.duplicate.confirm'),
      })
    },
    [activityIndex, requestConfirm, t],
  )

  const workflowReadyForMode = workflowMode === 'auto' || selectedWorkflow.trim().length > 0

  const enqueueOnly = useCallback(
    async (draft: string) => {
      if (!issue || !workflowReadyForMode) return
      setActionBusy(true)
      try {
        if (!(await confirmIfIssueRunning(issue))) return
        await performEnqueue(draft, issue, workflowMode)
      } finally {
        setActionBusy(false)
      }
    },
    [confirmIfIssueRunning, issue, performEnqueue, workflowMode, workflowReadyForMode],
  )

  // Quick action from a list row: always Auto workflow selection, no detail
  // selection required. Fetches the full issue to build the task draft/title.
  const enqueueIssueAuto = useCallback(
    async (item: GitHubIssueListItem) => {
      const ref = formatIssueRefKey(item.repository, item.number)
      // Guard the one-tap quick action behind an explicit confirm: pressing it
      // auto-selects a workflow and enqueues, so make that intent deliberate.
      const confirmed = await requestConfirm({
        title: t('views.issue.confirm.enqueueAuto.title'),
        message: t('views.issue.confirm.enqueueAuto.message', { ref }),
        confirmLabel: t('views.issue.confirm.enqueueAuto.confirm'),
      })
      if (!confirmed) return
      setActionBusy(true)
      try {
        let fetched: GitHubIssueView
        try {
          fetched = await window.orbit.fetchGitHubIssue({
            ref: `${item.repository.owner}/${item.repository.name}#${item.number}`,
          })
        } catch (error) {
          pushToast({
            kind: 'error',
            title: t('views.issue.toast.enqueueFailed.title'),
            message: toErrorMessage(error, t('views.issue.toast.enqueueFailed.message')),
          })
          return
        }
        if (!(await confirmIfIssueRunning(fetched))) return
        const draft = buildIssueTaskDraft(fetched)
        if (options.prepareBeforeAutoEnqueue) {
          const canProceed = await options.prepareBeforeAutoEnqueue({
            draft,
            title: buildIssueTaskTitle(fetched),
          })
          if (!canProceed) return
        }
        try {
          await performEnqueue(draft, fetched, 'auto')
        } catch {
          // enqueue failure toast already shown
        }
      } finally {
        setActionBusy(false)
      }
    },
    [
      confirmIfIssueRunning,
      options.prepareBeforeAutoEnqueue,
      performEnqueue,
      pushToast,
      requestConfirm,
      t,
    ],
  )

  const runSingle = useCallback(
    async (draft: string) => {
      if (!issue || !workflowReadyForMode) return
      setActionBusy(true)
      try {
        if (!(await confirmIfIssueRunning(issue))) return
        const result = await performEnqueue(draft, issue, workflowMode)
        if (!result?.taskId) return
        try {
          await window.orbit.runPendingTask({ taskId: result.taskId })
          pushToast({
            kind: 'info',
            title: t('views.issue.toast.runStarted.title'),
            message: t('views.issue.toast.runStarted.message'),
          })
        } catch (error) {
          pushToast({
            kind: 'warn',
            title: t('views.issue.toast.runPendingFailed.title'),
            message: toErrorMessage(error, t('views.issue.toast.runPendingFailed.message')),
          })
        }
      } catch {
        // enqueue failure toast already shown
      } finally {
        setActionBusy(false)
      }
    },
    [
      confirmIfIssueRunning,
      issue,
      performEnqueue,
      pushToast,
      t,
      workflowMode,
      workflowReadyForMode,
    ],
  )

  return {
    issueList,
    pageIndex,
    canGoPrev,
    canGoNext,
    listLoading,
    listErrorCode,
    listErrorDetail,
    selectedIssueNumber,
    selectedIssueListItem,
    issue,
    issueErrorCode,
    issueErrorDetail,
    issueLoading,
    actionBusy,
    selectedWorkflow,
    workflowMode,
    activityIndex,
    loadFirstPage,
    refreshList: loadFirstPage,
    goPrevPage,
    goNextPage,
    selectIssue,
    enqueueOnly,
    enqueueIssueAuto,
    runSingle,
  }
}
