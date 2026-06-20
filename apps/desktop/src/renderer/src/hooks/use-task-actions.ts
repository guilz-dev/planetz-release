import type {
  AutoWorkflowDecision,
  CreateResultPrInput,
  CreateResultPrResult,
  EnqueueTaskResult,
  TaskResultDiffFile,
  TaskResultDiffSummary,
  TaskViewModel,
} from '@planetz/shared'
import { useCallback } from 'react'
import { type I18nKey, type TranslateFn, useI18n } from '../i18n'
import { ollamaGuardWarnMessageForDraft } from '../lib/ollama-guard-warn.js'
import type { PromptComposerRunDraft } from '../lib/prompt-composer-run-draft.js'
import {
  checkResultBranchCached,
  invalidateResultBranchCheck,
  refreshResultBranchCheck,
} from '../lib/result-branch-check-cache.js'
import { toErrorMessage } from '../lib/to-error-message.js'
import { workflowEnqueueBridgeInput } from '../lib/workflow-enqueue-bridge-input.js'
import { useAppStore } from '../store/app-store'
import type { ConfirmDialogRequest } from './use-confirm-dialog.js'
import { usePushToast } from './use-toast'

async function maybeToastOllamaGuardWarn(
  draft: PromptComposerRunDraft,
  recentWorkflowNames: string[],
  pushToast: ReturnType<typeof usePushToast>,
  t: TranslateFn,
): Promise<void> {
  const warnMessage = await ollamaGuardWarnMessageForDraft(draft, recentWorkflowNames, t)
  if (!warnMessage) return
  pushToast({
    kind: 'warn',
    title: t('composer.ollamaGuardWarn.title'),
    message: warnMessage,
  })
}

function formatAutoToast(
  decision: AutoWorkflowDecision,
  t: TranslateFn,
  variant: 'enqueue' | 'runNow' = 'enqueue',
): string {
  const key =
    variant === 'runNow'
      ? decision.fallbackApplied
        ? 'composer.autoToastFallbackRunNow'
        : 'composer.autoToastRunNow'
      : decision.fallbackApplied
        ? 'composer.autoToastFallback'
        : 'composer.autoToast'
  return t(key as I18nKey, {
    group: decision.group,
    workflow: decision.selectedWorkflow,
    confidence: decision.confidence,
  })
}

export interface UseTaskActionsOptions {
  requestConfirm?: (req: ConfirmDialogRequest | string) => Promise<boolean>
}

export function useTaskActions(options?: UseTaskActionsOptions) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const requestConfirm = options?.requestConfirm

  const selectTask = useCallback((taskId: string) => {
    useAppStore.getState().setSelectedTaskId(taskId === '' ? undefined : taskId)
    void window.orbit.selectTask(taskId)
  }, [])

  const clearSelection = useCallback(() => {
    useAppStore.getState().setSelectedTaskId(undefined)
    void window.orbit.selectTask('')
  }, [])

  const runPendingTask = useCallback(
    async (task: TaskViewModel) => {
      try {
        await window.orbit.runPendingTask({ taskId: task.id })
        pushToast({
          kind: 'info',
          title: t('toast.runStarted.title'),
          message: t('composer.runNowStarted'),
        })
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.runFailed.title'),
          message: toErrorMessage(error, 'Failed to run task now'),
        })
        throw error
      }
    },
    [pushToast, t],
  )

  const stopTask = useCallback(
    async (task: TaskViewModel) => {
      try {
        await window.orbit.stopTask({ taskId: task.id })
        pushToast({
          kind: 'success',
          title: t('toast.stopSucceeded.title'),
          message: t('panels.running.stop'),
        })
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.stopFailed.title'),
          message: toErrorMessage(error, 'Failed to stop task'),
        })
        throw error
      }
    },
    [pushToast, t],
  )

  const resumeStoppedTask = useCallback(
    async (task: TaskViewModel) => {
      try {
        await window.orbit.resumeStoppedTask({ taskId: task.id })
        pushToast({
          kind: 'success',
          title: t('toast.resumeSucceeded.title'),
          message: t('panels.pending.resume'),
        })
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.resumeFailed.title'),
          message: toErrorMessage(error, 'Failed to resume task'),
        })
        throw error
      }
    },
    [pushToast, t],
  )

  const deletePendingTask = useCallback(
    async (task: TaskViewModel) => {
      const confirmMessage = t('panels.pending.deleteConfirm', { title: task.title })
      const confirmed = requestConfirm
        ? await requestConfirm({
            title: t('panels.pending.deleteTitle'),
            message: confirmMessage,
            confirmLabel: t('panels.pending.delete'),
          })
        : typeof globalThis.confirm === 'function'
          ? globalThis.confirm(confirmMessage)
          : true
      if (!confirmed) {
        return
      }
      try {
        await window.orbit.deleteTask({ taskId: task.id })
        pushToast({
          kind: 'success',
          title: t('toast.deleteSucceeded.title'),
          message: task.title,
        })
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.deleteFailed.title'),
          message: toErrorMessage(error, 'Failed to delete task'),
        })
        throw error
      }
    },
    [pushToast, requestConfirm, t],
  )

  const applyEnqueueSuccessToasts = useCallback(
    (result: EnqueueTaskResult, variant: 'enqueue' | 'runNow' = 'enqueue') => {
      if (result.autoDecision) {
        useAppStore.getState().setLastAutoDecision(result.autoDecision)
        useAppStore.getState().pushRecentWorkflow(result.autoDecision.selectedWorkflow)
        pushToast({
          kind: 'info',
          title: variant === 'runNow' ? t('toast.runStarted.title') : t('composer.autoToggle'),
          message: formatAutoToast(result.autoDecision, t, variant),
        })
      }
    },
    [pushToast, t],
  )

  const enqueueTask = useCallback(
    async (draft: PromptComposerRunDraft) => {
      try {
        const recentWorkflowNames = useAppStore.getState().recentWorkflowNames
        await maybeToastOllamaGuardWarn(draft, recentWorkflowNames, pushToast, t)
        const result = await window.orbit.enqueueTask(
          workflowEnqueueBridgeInput(draft, recentWorkflowNames),
        )
        applyEnqueueSuccessToasts(result)
        return result
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.enqueueFailed.title'),
          message: toErrorMessage(error, 'Failed to enqueue task'),
        })
        throw error
      }
    },
    [applyEnqueueSuccessToasts, pushToast, t],
  )

  const runTaskNow = useCallback(
    async (draft: PromptComposerRunDraft) => {
      try {
        const recentWorkflowNames = useAppStore.getState().recentWorkflowNames
        await maybeToastOllamaGuardWarn(draft, recentWorkflowNames, pushToast, t)
        const result = await window.orbit.runTaskNow(
          workflowEnqueueBridgeInput(draft, recentWorkflowNames),
        )
        if (result?.autoDecision) {
          applyEnqueueSuccessToasts(result, 'runNow')
        } else {
          pushToast({
            kind: 'info',
            title: t('toast.runStarted.title'),
            message: t('composer.runNowStarted'),
          })
        }
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.runFailed.title'),
          message: toErrorMessage(error, 'Failed to run task now'),
        })
        throw error
      }
    },
    [applyEnqueueSuccessToasts, pushToast, t],
  )

  const deletePromptHistoryItem = useCallback(async (id: string) => {
    await window.orbit.deletePromptHistoryItem({ id })
  }, [])

  const listTaskResultDiff = useCallback(
    (input: { taskId: string; branch: string }): Promise<TaskResultDiffSummary> =>
      window.orbit.listTaskResultDiff(input),
    [],
  )

  const getTaskResultDiffFile = useCallback(
    (input: { taskId: string; branch: string; path: string }): Promise<TaskResultDiffFile> =>
      window.orbit.getTaskResultDiffFile(input),
    [],
  )

  const mergeResult = useCallback(async (input: { taskId: string; branch: string }) => {
    const output = await window.orbit.mergeResult(input)
    invalidateResultBranchCheck(input.branch)
    return output
  }, [])

  const checkResultBranch = useCallback(
    (input: { taskId: string; branch: string }) => checkResultBranchCached(input),
    [],
  )

  const refreshResultBranch = useCallback(
    (input: { taskId: string; branch: string }) => refreshResultBranchCheck(input),
    [],
  )

  const createResultPr = useCallback(
    async (input: CreateResultPrInput): Promise<CreateResultPrResult> => {
      try {
        const result = await window.orbit.createResultPr(input)
        if (result.status === 'already_exists') {
          pushToast({
            kind: 'info',
            title: t('toast.prExists.title'),
            message: t('toast.prExists.message', { number: String(result.pr.number) }),
          })
        } else {
          pushToast({
            kind: 'success',
            title: t('toast.prCreated.title'),
            message: t('toast.prCreated.message', { number: String(result.pr.number) }),
          })
        }
        return result
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('toast.prCreateFailed.title'),
          message: toErrorMessage(error, t('toast.prCreateFailed.title')),
        })
        throw error
      }
    },
    [pushToast, t],
  )

  const openTaskWorkDir = useCallback(
    async (task: TaskViewModel) => {
      try {
        const result = await window.orbit.openTaskWorkDir({ taskId: task.id })
        if (result.status === 'opened') return
        const message =
          result.message ??
          (result.status === 'not_found'
            ? 'Work directory not found'
            : t('panels.task.openWorkDirFailed'))
        pushToast({
          kind: 'error',
          title: t('panels.task.openWorkDirFailed'),
          message,
        })
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('panels.task.openWorkDirFailed'),
          message: toErrorMessage(error, t('panels.task.openWorkDirFailed')),
        })
        throw error
      }
    },
    [pushToast, t],
  )

  return {
    selectTask,
    clearSelection,
    runPendingTask,
    stopTask,
    resumeStoppedTask,
    deletePendingTask,
    enqueueTask,
    runTaskNow,
    deletePromptHistoryItem,
    listTaskResultDiff,
    getTaskResultDiffFile,
    mergeResult,
    checkResultBranch,
    refreshResultBranch,
    createResultPr,
    openTaskWorkDir,
  }
}
