import {
  buildIssueTaskDraft,
  buildIssueTaskTitle,
  formatIssueRefKey,
  type WorkflowRunOverride,
  type WorkflowSummary,
} from '@planetz/shared'
import { Inbox } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfirmDialog } from '../hooks/use-confirm-dialog'
import { useIssueTabActions } from '../hooks/use-issue-tab-actions'
import { useWorkflowEnqueueGate } from '../hooks/use-workflow-enqueue-gate.js'
import { useWorkflowRoutingPreview } from '../hooks/use-workflow-routing-preview.js'
import { useI18n } from '../i18n'
import { issueTaskActivityForRef } from '../lib/issue-task-activity'
import { workflowChangeClearingRunOverride } from '../lib/workflow-change-clearing-run-override.js'
import { useAppStore } from '../store/app-store'
import { IssueTabDetailPane } from './issue-tab-detail-pane'
import { IssueTabListPane } from './issue-tab-list-pane'
import { issueErrorMessage, issueErrorRecoveryCommand } from './issue-tab-presentational'
import { ReportMarkdownContent } from './report-markdown-content'
import { LowConfidenceGateDialog } from './workflow-selection/low-confidence-gate-dialog.js'
import { WorkflowSelectionBar } from './workflow-selection/workflow-selection-bar.js'

export interface IssueTabProps {
  workspacePath: string
  workflows: WorkflowSummary[]
  builtinWorkflowCategoryOrder?: string[]
  recentWorkflowNames: string[]
  pendingCount: number
  onNewWorkflow?: () => void
  onWorkflowCopied?: (name: string) => void | Promise<void>
}

export function IssueTab({
  workspacePath,
  workflows,
  builtinWorkflowCategoryOrder,
  recentWorkflowNames,
  pendingCount,
  onNewWorkflow,
  onWorkflowCopied,
}: IssueTabProps) {
  const { t } = useI18n()
  const { requestConfirm, confirmDialog } = useConfirmDialog()
  const setSelectedWorkflow = useAppStore((s) => s.setSelectedWorkflow)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const setPanelVisible = useAppStore((s) => s.setPanelVisible)
  const setComposerAssistHandoff = useAppStore((s) => s.setComposerAssistHandoff)
  const workflowMode = useAppStore((s) => s.workflowMode)
  const setWorkflowMode = useAppStore((s) => s.setWorkflowMode)
  const workflowLowConfidenceGateEnabled = useAppStore((s) => s.workflowLowConfidenceGateEnabled)
  const [runOverride, setRunOverride] = useState<WorkflowRunOverride | undefined>()
  const routing = useWorkflowRoutingPreview(runOverride)
  const gate = useWorkflowEnqueueGate({
    gateEnabled: workflowLowConfidenceGateEnabled,
    workflowMode,
    routingPreview: routing.routingPreview,
    routingPreviewRef: routing.routingPreviewRef,
    applyRouting: routing.applyRouting,
  })

  const handleWorkflowChange = useCallback(
    (workflow: string) => {
      workflowChangeClearingRunOverride(workflow, setRunOverride, setSelectedWorkflow)
    },
    [setSelectedWorkflow],
  )

  const prepareBeforeAutoEnqueue = useCallback(
    async (input: { draft: string; title: string }) => {
      const result = await gate.prepareForEnqueue({
        body: input.draft,
        title: input.title,
      })
      if (!result.proceed) {
        gate.openIssueGate({ kind: 'issue', draft: input.draft, action: 'enqueueAuto' })
        return false
      }
      return true
    },
    [gate],
  )

  const {
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
    activityIndex,
    loadFirstPage,
    refreshList,
    goPrevPage,
    goNextPage,
    selectIssue,
    enqueueOnly,
    enqueueIssueAuto,
    runSingle,
  } = useIssueTabActions(recentWorkflowNames, {
    requestConfirm,
    getEnqueueExtras: routing.getEnqueueExtras,
    prepareBeforeAutoEnqueue,
  })

  const [draft, setDraft] = useState('')
  const [listExpanded, setListExpanded] = useState(true)
  const [refineBusy, setRefineBusy] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const lastWorkspacePathRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastWorkspacePathRef.current === workspacePath) return
    lastWorkspacePathRef.current = workspacePath
    void loadFirstPage()
  }, [loadFirstPage, workspacePath])

  useEffect(() => {
    setRefineError(null)
    if (issue) {
      setDraft(buildIssueTaskDraft(issue))
    }
  }, [issue])

  const tryGateBeforeIssueAction = useCallback(
    async (body: string, action: 'enqueue' | 'runSingle') => {
      const result = await gate.prepareForEnqueue({
        body,
        title: issue ? buildIssueTaskTitle(issue) : undefined,
      })
      if (!result.proceed) {
        gate.openIssueGate({ kind: 'issue', draft: body, action })
        return false
      }
      return true
    },
    [gate, issue],
  )

  async function guardedIssueAction(body: string, action: 'enqueue' | 'runSingle'): Promise<void> {
    if (!(await tryGateBeforeIssueAction(body, action))) return
    if (action === 'enqueue') {
      await enqueueOnly(body)
      return
    }
    await runSingle(body)
  }

  async function handleRefineInComposer() {
    if (!issue || refineBusy) return
    const issueRef = formatIssueRefKey(issue.repository, issue.number)
    setRefineBusy(true)
    setRefineError(null)
    try {
      const { sourceContext } = await window.orbit.buildComposerSourceContext({
        kind: 'issue',
        ref: issueRef,
      })
      setComposerAssistHandoff({
        sourceContext,
        workflow: selectedWorkflow.trim() || undefined,
        issueRef,
      })
      setPanelVisible('composer', true)
      setActiveView('task')
    } catch {
      setRefineError(t('views.issue.actions.refineFailed'))
    } finally {
      setRefineBusy(false)
    }
  }

  const singleRunBlocked = pendingCount > 0
  const hasIssueSelection = issue !== null
  const autoMode = workflowMode === 'auto'
  const workflowReady = hasIssueSelection && (autoMode || selectedWorkflow.trim().length > 0)
  const selectedIssueActivity = issue
    ? issueTaskActivityForRef(activityIndex, issue.repository, issue.number)
    : { totalCount: 0, runningCount: 0, queuedCount: 0 }
  const selectedIssueActive =
    selectedIssueActivity.runningCount > 0 || selectedIssueActivity.queuedCount > 0
  const canRunSingle =
    !singleRunBlocked && workflowReady && !actionBusy && !issueLoading && !selectedIssueActive
  const detailErrorRecoveryCommand = issueErrorRecoveryCommand(issueErrorCode)
  const showDetailError = selectedIssueListItem && issueErrorCode
  const showDetailLoading = issueLoading && !issue
  const showDetail = issue && !issueErrorCode

  function resumeIssueGateAction(workflow: string) {
    const pending = gate.issuePending
    setSelectedWorkflow(workflow)
    setWorkflowMode('manual')
    routing.setConfirmedWorkflow(workflow)
    gate.closeGate()
    if (!pending) return
    if (pending.action === 'enqueue' || pending.action === 'enqueueAuto') {
      void enqueueOnly(pending.draft)
      return
    }
    void runSingle(pending.draft)
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <IssueTabListPane
        listExpanded={listExpanded}
        onToggleListExpanded={() => setListExpanded((value) => !value)}
        listLoading={listLoading}
        actionBusy={actionBusy}
        listErrorCode={listErrorCode}
        listErrorDetail={listErrorDetail}
        issueList={issueList}
        selectedIssueNumber={selectedIssueNumber}
        activityIndex={activityIndex}
        pageIndex={pageIndex}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onRefresh={refreshList}
        onSelectIssue={(item) => {
          setListExpanded(false)
          void selectIssue(item)
        }}
        onEnqueueAuto={(item) => void enqueueIssueAuto(item)}
        onPrevPage={goPrevPage}
        onNextPage={goNextPage}
      />

      {!listExpanded ? (
        <section className="flex min-w-0 flex-1 flex-col">
          {!hasIssueSelection && !showDetailLoading && !showDetailError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <Inbox size={32} className="text-[var(--color-muted)]" />
              <p className="text-sm font-medium text-[var(--color-text-strong)]">
                {t('views.issue.run.emptyTitle')}
              </p>
              <p className="max-w-sm text-xs text-[var(--color-muted-strong)]">
                {t('views.issue.run.emptyHint')}
              </p>
            </div>
          ) : null}

          {showDetailLoading ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="text-xs text-[var(--color-muted-strong)]">
                {t('views.issue.preview.loading')}
              </p>
            </div>
          ) : null}

          {showDetailError && issueErrorCode ? (
            <div className="flex flex-1 items-start justify-center px-6 pt-12">
              <div
                role="alert"
                className="w-full max-w-lg rounded-md border border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/25 px-3 py-2.5 text-xs text-[var(--color-text)]"
              >
                <p className="font-medium text-[var(--color-status-failed)]">
                  {issueErrorMessage(t, issueErrorCode)}
                </p>
                {issueErrorDetail ? (
                  <p className="mt-1 text-[var(--color-muted-strong)]">{issueErrorDetail}</p>
                ) : null}
                {detailErrorRecoveryCommand ? (
                  <p className="mt-1 text-[var(--color-muted-strong)]">
                    {t('views.issue.list.recoveryHint', { command: detailErrorRecoveryCommand })}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {showDetail ? (
            <IssueTabDetailPane
              issue={issue}
              totalCount={selectedIssueActivity.totalCount}
              runningCount={selectedIssueActivity.runningCount}
              bodyContent={
                <ReportMarkdownContent
                  content={issue.body}
                  className="text-sm [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm [&_pre]:text-xs [&_table]:text-sm"
                />
              }
              draft={draft}
              onDraftChange={setDraft}
              actionBusy={actionBusy}
              issueLoading={issueLoading}
              pendingCount={pendingCount}
              workflowReady={workflowReady}
              canRunSingle={canRunSingle}
              onEnqueue={() => void guardedIssueAction(draft, 'enqueue')}
              onRunSingle={() => void guardedIssueAction(draft, 'runSingle')}
              onRefineInComposer={() => void handleRefineInComposer()}
              refineBusy={refineBusy}
              refineError={refineError}
              workflowControl={
                <WorkflowSelectionBar
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  onWorkflowChange={handleWorkflowChange}
                  workflowMode={workflowMode}
                  onWorkflowModeChange={setWorkflowMode}
                  promptTitle={issue ? buildIssueTaskDraft(issue).slice(0, 120) : undefined}
                  promptBody={draft}
                  disabled={actionBusy}
                  onNewWorkflow={onNewWorkflow}
                  builtinWorkflowCategoryOrder={builtinWorkflowCategoryOrder}
                  recentWorkflowNames={recentWorkflowNames}
                  runOverride={runOverride}
                  onRunOverrideChange={setRunOverride}
                  confirmedWorkflow={routing.routingPreview.confirmedWorkflow}
                  onConfirmedWorkflowChange={routing.setConfirmedWorkflow}
                  onPreviewRoutingChange={routing.onPreviewRoutingChange}
                  onWorkflowCopied={onWorkflowCopied}
                />
              }
            />
          ) : null}
        </section>
      ) : null}
      {confirmDialog}
      <LowConfidenceGateDialog
        open={gate.open}
        decision={gate.gateDecision}
        onCancel={gate.closeGate}
        onChoose={resumeIssueGateAction}
      />
    </div>
  )
}
