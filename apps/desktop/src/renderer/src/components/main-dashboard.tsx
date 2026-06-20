import {
  type AppState,
  BUNDLED_ORBIT_UNAVAILABLE_DASHBOARD,
  type ChainEdge,
  filterTaskUsableWorkflows,
  filterUserVisibleWorkflows,
  type IntegrationAdapterId,
  type PromptHistoryItem,
  type RecentWorkspace,
  type SkinDefinition,
  stripRuntimeWorkflowOverrideSuffix,
  type TaskViewModel,
  type UiConfig,
} from '@planetz/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirmDialog } from '../hooks/use-confirm-dialog.js'
import { usePendingDecisionCount } from '../hooks/use-intent-ledger-queue'
import { useAllowedProvidersFromConfig } from '../hooks/use-provider-selection'
import { useTaskActions } from '../hooks/use-task-actions'
import { useWorkspaceActions } from '../hooks/use-workspace-actions'
import { useI18n, useResolvedPanelTitle } from '../i18n'
import { buildTaskChatSourceContext } from '../lib/build-task-chat-source-context.js'
import { queueChatAssistHandoff } from '../lib/chat-assist-handoff.js'
import { resolveComposerWorkflowName } from '../lib/composer-workflow-selection.js'
import {
  createOptimisticComposerTaskId,
  isOptimisticComposerTaskId,
} from '../lib/optimistic-composer-task.js'
import type { WorkspaceUiTab } from '../lib/workspace-ui-tab'
import { SkinProvider } from '../skins/context'
import { applySkinTokens } from '../skins/registry'
import { useAppStore } from '../store/app-store'
import { AdapterView } from './adapter-view'
import { AppHeader, type AppHeaderPanelEntry } from './app-header'
import { BridgeRevisionDevBanner } from './bridge-revision-dev-banner'
import { ChainCreateDialog } from './chain-create-dialog'
import { DecisionsView } from './decisions-view'
import { DetailPanel } from './detail-panel'
import { ExecutionLogView } from './execution-log-view'
import { ExecutionSummaryView } from './execution-summary-view'
import { ExecutorStrip } from './executor-strip'
import { FloatingPanel } from './floating-panel'
import { IssueTab } from './issue-tab'
import { OverviewPanel } from './overview-panel'
import { PanelRestoreStrip } from './panel-restore-strip'
import { PromptComposer } from './prompt-composer'
import { type RetryAction, RetryActionDialog } from './retry-action-dialog'
import { SddOpenBanner } from './sdd-open-banner'
import type { FacetSelection } from './settings/settings-facets-panel'
import { WorkflowEditor } from './settings/workflow-editor'
import { SettingsModal, type SettingsTab } from './settings-modal'
import { SpecStudio } from './spec-studio/spec-studio'
import { TaskLane } from './task-lane'
import { cn } from './ui/cn'
import { VerticalTabRail } from './vertical-tab-rail'
import { WorkspaceBootstrapBanner } from './workspace-bootstrap-banner'
import { WorkspaceTabStrip } from './workspace-tab-strip'

const OPTIMISTIC_COMPOSER_TITLE_MAX = 64

function summarizeComposerBody(body: string): string {
  const firstLine = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  const normalized = firstLine ?? body.trim()
  if (normalized.length <= OPTIMISTIC_COMPOSER_TITLE_MAX) return normalized
  return `${normalized.slice(0, OPTIMISTIC_COMPOSER_TITLE_MAX - 3).trimEnd()}...`
}

export interface MainDashboardWorkspaceSlice {
  checkingCli: boolean
  onRecheckCli: () => void
  recentWorkspaces: RecentWorkspace[]
  tabs: ReadonlyArray<WorkspaceUiTab>
  onOpenRecentWorkspace: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace: (path: string) => Promise<void>
  onRefreshPromptHistory: () => Promise<void>
  onChangeWorkspace: () => void
  onSelectWorkspaceTab: (path: string) => void
  onCloseWorkspaceTab: (path: string) => void
}

export interface MainDashboardSettingsSlice {
  settingsOpen: boolean
  settingsConfig: UiConfig | null
  settingsInitialTab: SettingsTab | null
  settingsInitialFacetSelection: FacetSelection | null
  workflowCreateRequest: number
  onOpenSettings: () => void
  onOpenSettingsToFacets: (selection: FacetSelection) => void
  onOpenSettingsToIntegrations: () => void
  onNewWorkflow: () => void
  onCloseSettings: () => void
  onSettingsSaved: () => void
}

export interface MainDashboardRetrySlice {
  retryDialog: { open: boolean; action: RetryAction | null; task: TaskViewModel | null }
  retryBusy: boolean
  onRequestRetryAction: (action: RetryAction, task: TaskViewModel) => void
  onCloseRetryDialog: () => void
  onConfirmRetryAction: (prompt: string) => Promise<void>
}

export interface MainDashboardChainSlice {
  chainDialog: { open: boolean; origin: TaskViewModel | null }
  chainBusy: boolean
  onRequestCreateChain: (origin: TaskViewModel) => void
  onCloseChainDialog: () => void
  onConfirmChainCreate: (input: {
    title: string
    body: string
    workflow: string
    mode: 'branch_handoff' | 'merge_then_continue'
    sourceBranch?: string
    baseBranch?: string
  }) => Promise<void>
  onUnlinkChainEdge: (chainId: string, edge: ChainEdge) => Promise<void>
  onMaterializeChain: (input: { chainId: string; fromTaskId: string }) => Promise<void>
  chainMaterializeBusy: boolean
  chainMaterializeWarning: string | null
}

export interface MainDashboardIntegrationSlice {
  hookBearerSecret: string | null
  onDismissHookBearerSecret: () => void
  onToggleHookServer: (input: {
    enabled: boolean
    port?: number
  }) => Promise<{ bearerSecret?: string }>
  onToggleAdapter: (id: IntegrationAdapterId, enabled: boolean) => Promise<void>
  onPushAdapter: (id: IntegrationAdapterId) => Promise<void>
}

interface MainDashboardProps {
  state: AppState
  skin: SkinDefinition
  promptHistory: PromptHistoryItem[]
  workspace: MainDashboardWorkspaceSlice
  settings: MainDashboardSettingsSlice
  retry: MainDashboardRetrySlice
  chain: MainDashboardChainSlice
  integration: MainDashboardIntegrationSlice
}

export function MainDashboard(props: MainDashboardProps) {
  const {
    state,
    skin,
    promptHistory,
    workspace: {
      checkingCli,
      onRecheckCli,
      recentWorkspaces,
      tabs,
      onOpenRecentWorkspace,
      onRemoveRecentWorkspace,
      onRefreshPromptHistory,
      onChangeWorkspace,
      onSelectWorkspaceTab,
      onCloseWorkspaceTab,
    },
    settings: {
      settingsOpen,
      settingsConfig,
      settingsInitialTab,
      settingsInitialFacetSelection,
      workflowCreateRequest,
      onOpenSettings,
      onOpenSettingsToFacets,
      onOpenSettingsToIntegrations,
      onNewWorkflow,
      onCloseSettings,
      onSettingsSaved,
    },
    retry: {
      retryDialog,
      retryBusy,
      onRequestRetryAction,
      onCloseRetryDialog,
      onConfirmRetryAction,
    },
    chain: {
      chainDialog,
      chainBusy,
      onRequestCreateChain,
      onCloseChainDialog,
      onConfirmChainCreate,
      onUnlinkChainEdge,
      onMaterializeChain,
      chainMaterializeBusy,
      chainMaterializeWarning,
    },
    integration: {
      hookBearerSecret,
      onDismissHookBearerSecret,
      onToggleHookServer,
      onToggleAdapter,
      onPushAdapter,
    },
  } = props

  const { t } = useI18n()
  const tasksPanelLabel = useResolvedPanelTitle('tasks')
  const composerPanelLabel = useResolvedPanelTitle('composer')
  const selectedWorkflow = useAppStore((s) => s.selectedWorkflow)
  const workflowMode = useAppStore((s) => s.workflowMode)
  const lastAutoDecision = useAppStore((s) => s.lastAutoDecision)
  const recentWorkflowNames = useAppStore((s) => s.recentWorkflowNames)
  const setSelectedWorkflow = useAppStore((s) => s.setSelectedWorkflow)
  const selectWorkflowForComposer = useAppStore((s) => s.selectWorkflowForComposer)
  const workspaceSwitching = useAppStore((s) => s.workspaceSwitching)
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const setChatAssistHandoff = useAppStore((s) => s.setChatAssistHandoff)
  const setChatHandoffError = useAppStore((s) => s.setChatHandoffError)
  const openExecutionLogForTask = useAppStore((s) => s.openExecutionLogForTask)
  const openExecutionLogForFailure = useAppStore((s) => s.openExecutionLogForFailure)
  const openDecisionsForTask = useAppStore((s) => s.openDecisionsForTask)
  const executorFilterByView = useAppStore((s) => s.executorFilterByView)
  const setExecutorFilter = useAppStore((s) => s.setExecutorFilter)
  const panelVisibility = useAppStore((s) => s.panelVisibility)
  const setPanelVisible = useAppStore((s) => s.setPanelVisible)
  const resetPanelVisibility = useAppStore((s) => s.resetPanelVisibility)
  const allowedProviders = useAllowedProvidersFromConfig(settingsConfig)
  const { requestConfirm, confirmDialog } = useConfirmDialog()
  const taskActions = useTaskActions({ requestConfirm })
  const pendingDecisionCount = usePendingDecisionCount()
  const workspaceActions = useWorkspaceActions({
    selectedWorkflow,
    setSelectedWorkflow,
    watchRunning: state.connection.watch === 'running',
  })
  const tasksVisible = panelVisibility.tasks
  const composerVisible = panelVisibility.composer

  const taskGridCols = [tasksVisible ? 'minmax(0,1fr)' : null, '340px']
    .filter((v): v is string => v !== null)
    .join(' ')
  const cliReady = state.connection.cli === 'ok'
  const cliGuidance =
    state.connection.cli === 'ng'
      ? BUNDLED_ORBIT_UNAVAILABLE_DASHBOARD
      : state.connection.cli === 'unknown'
        ? t('connection.cliUnknownBeforeEnqueue')
        : null

  const selectedTask = state.tasks.find((t) => t.id === state.selectedTaskId)
  const executorsIdle = useMemo(
    () => state.executors.filter((e) => e.status === 'idle').length,
    [state.executors],
  )
  const pendingTaskCountFromState = useMemo(
    () => state.tasks.filter((task) => task.status === 'pending').length,
    [state.tasks],
  )

  // TaskLane needs a way to jump to the Error tab from Overview — managed inside TaskLane via state.
  // For cross-component jump we expose via a small ref-like mechanism: bumping a counter.
  const [errorJump, setErrorJump] = useState(0)

  const taskExecutorFilterId = executorFilterByView.task
  const logExecutorFilterId = executorFilterByView.log

  const [workflowCatalogFilter, setWorkflowCatalogFilter] = useState<ReadonlySet<string> | null>(
    null,
  )
  const [workflowCatalogFilterLabel, setWorkflowCatalogFilterLabel] = useState<string | null>(null)
  const [optimisticComposerTasks, setOptimisticComposerTasks] = useState<TaskViewModel[]>([])

  const addOptimisticComposerTask = useCallback(
    (draft: { body: string; workflowMode: 'manual' | 'auto'; workflow?: string }) => {
      const optimisticTaskId = createOptimisticComposerTaskId()
      const now = new Date().toISOString()
      const normalizedWorkflow =
        draft.workflowMode === 'manual'
          ? draft.workflow?.trim() || undefined
          : (lastAutoDecision?.selectedWorkflow ?? selectedWorkflow).trim() || undefined
      const fallbackTitle = t('composer.optimisticPreparingFallback')
      const draftTitle = summarizeComposerBody(draft.body)
      setOptimisticComposerTasks((current) => [
        {
          id: optimisticTaskId,
          title: t('composer.optimisticPreparingTitle', {
            title: draftTitle.length > 0 ? draftTitle : fallbackTitle,
          }),
          body: draft.body,
          workflow: normalizedWorkflow,
          ...(normalizedWorkflow
            ? {
                workflowSelection: {
                  kind: draft.workflowMode === 'auto' ? ('auto' as const) : ('manual' as const),
                  baseWorkflow: stripRuntimeWorkflowOverrideSuffix(normalizedWorkflow),
                  displayLabel: normalizedWorkflow,
                },
              }
            : {}),
          priority: 'normal',
          status: 'pending',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ])
      return optimisticTaskId
    },
    [lastAutoDecision?.selectedWorkflow, selectedWorkflow, t],
  )

  const removeOptimisticComposerTask = useCallback((taskId: string) => {
    setOptimisticComposerTasks((current) => current.filter((task) => task.id !== taskId))
  }, [])

  const visibleTasks = useMemo(
    () => [...optimisticComposerTasks, ...state.tasks],
    [optimisticComposerTasks, state.tasks],
  )
  const pendingTaskCount = useMemo(
    () =>
      pendingTaskCountFromState +
      optimisticComposerTasks.filter((task) => task.status === 'pending').length,
    [optimisticComposerTasks, pendingTaskCountFromState],
  )

  const workspaceId = state.workspace.id
  useEffect(() => {
    setOptimisticComposerTasks([])
  }, [workspaceId])

  const displayedView = activeView
  // Tasks/composer are task-view-only panels; they should not surface as
  // restore targets or header panel toggles on other primary screens.
  const panelEntries: ReadonlyArray<AppHeaderPanelEntry> =
    displayedView === 'task'
      ? [
          { id: 'tasks', label: tasksPanelLabel },
          { id: 'composer', label: composerPanelLabel },
        ]
      : []
  const closedPanels = panelEntries.filter((p) => !panelVisibility[p.id])
  const userVisibleWorkflows = useMemo(
    () => filterUserVisibleWorkflows(state.workflows),
    [state.workflows],
  )
  const composerWorkflows = useMemo(() => {
    const filtered = filterTaskUsableWorkflows(userVisibleWorkflows)
    return filtered.length > 0 ? filtered : userVisibleWorkflows
  }, [userVisibleWorkflows])

  const openExecutionLog = (task: (typeof state.tasks)[number]) =>
    task.failure ? openExecutionLogForFailure(task) : openExecutionLogForTask(task)

  const handleContinueTaskInChat = useCallback(
    (task: TaskViewModel) => {
      queueChatAssistHandoff(
        {
          sourceContext: buildTaskChatSourceContext(task),
          workflow: task.workflow?.trim() || selectedWorkflow.trim() || undefined,
          taskId: task.id,
          workspacePath: state.workspace.path,
        },
        { setChatAssistHandoff, setChatHandoffError, setActiveView },
      )
    },
    [
      selectedWorkflow,
      setActiveView,
      setChatAssistHandoff,
      setChatHandoffError,
      state.workspace.path,
    ],
  )

  const handleSelectTask = (taskId: string) => {
    if (isOptimisticComposerTaskId(taskId)) return
    taskActions.selectTask(taskId)
  }

  const toggleExecutorFilter = (executorId: string) => {
    const next = taskExecutorFilterId === executorId ? undefined : executorId
    setExecutorFilter('task', next)
    if (!tasksVisible) setPanelVisible('tasks', true)
  }

  useEffect(() => {
    if (taskExecutorFilterId && !state.executors.some((e) => e.id === taskExecutorFilterId)) {
      setExecutorFilter('task', undefined)
    }
    if (logExecutorFilterId && !state.executors.some((e) => e.id === logExecutorFilterId)) {
      setExecutorFilter('log', undefined)
    }
  }, [state.executors, taskExecutorFilterId, logExecutorFilterId, setExecutorFilter])

  useEffect(() => {
    applySkinTokens(document.documentElement, skin)
  }, [skin])

  useEffect(() => {
    if (composerWorkflows.length === 0) return
    if (!composerWorkflows.find((w) => w.name === selectedWorkflow)) {
      setSelectedWorkflow(resolveComposerWorkflowName(composerWorkflows, selectedWorkflow))
    }
  }, [composerWorkflows, selectedWorkflow, setSelectedWorkflow])

  return (
    <SkinProvider skin={skin}>
      <div className="relative flex h-full flex-col">
        {workspaceSwitching ? (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-surface)]/75 backdrop-blur-sm"
            aria-busy="true"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-[var(--color-muted-strong)]">
              {t('workspace.switching')}
            </p>
          </div>
        ) : null}
        <AppHeader
          state={state}
          selectedWorkflow={selectedWorkflow}
          workflowMode={workflowMode}
          lastAutoDecision={lastAutoDecision}
          checkingCli={checkingCli}
          onRecheckCli={() => void onRecheckCli()}
          onOpenSettings={() => void onOpenSettings()}
          onChangeWorkspace={() => void onChangeWorkspace()}
          recentWorkspaces={recentWorkspaces}
          onOpenRecentWorkspace={onOpenRecentWorkspace}
          onRemoveRecentWorkspace={onRemoveRecentWorkspace}
          onToggleWatch={() => void workspaceActions.toggleWatch()}
          panelVisibility={panelVisibility}
          panelEntries={panelEntries}
          onTogglePanel={(id, visible) => setPanelVisible(id, visible)}
          onResetPanels={resetPanelVisibility}
        />

        <WorkspaceTabStrip
          tabs={tabs}
          activePath={state.workspace.path}
          workspaceSwitching={workspaceSwitching}
          onSelect={onSelectWorkspaceTab}
          onClose={onCloseWorkspaceTab}
        />

        <BridgeRevisionDevBanner />

        <WorkspaceBootstrapBanner status={state.workspace.bootstrap} />

        {state.sddOpen ? <SddOpenBanner sddOpen={state.sddOpen} /> : null}

        {!cliReady && cliGuidance ? (
          <div
            role="status"
            className="border-b border-[var(--color-alert)]/30 bg-[var(--color-status-pending-soft)] px-4 py-2 text-xs text-[var(--color-alert)]"
          >
            {cliGuidance}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <VerticalTabRail
            active={displayedView}
            onChange={setActiveView}
            pendingDecisionCount={pendingDecisionCount}
          />

          <div className="flex min-h-0 flex-1 flex-col">
            {displayedView === 'task' ? (
              <ExecutorStrip
                executors={state.executors}
                selectedExecutorId={taskExecutorFilterId}
                onSelect={toggleExecutorFilter}
              />
            ) : null}

            <main className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              {displayedView === 'task' ? (
                <div
                  className="relative grid min-h-0 flex-1 gap-3"
                  style={{
                    gridTemplateColumns: taskGridCols,
                    gridTemplateRows: '1fr',
                  }}
                >
                  {tasksVisible ? (
                    <div className="min-h-0 overflow-hidden">
                      <TaskLane
                        className="h-full min-h-0"
                        tasks={visibleTasks}
                        retries={state.retries}
                        results={state.results}
                        executors={state.executors}
                        workflows={state.workflows}
                        executorFilterId={taskExecutorFilterId}
                        selectedTaskId={state.selectedTaskId}
                        skin={skin}
                        onSelect={handleSelectTask}
                        onRequestRetryAction={onRequestRetryAction}
                        onStopRunning={taskActions.stopTask}
                        onResumeStopped={
                          state.mockQueueEnabled ? taskActions.resumeStoppedTask : undefined
                        }
                        onRunPending={taskActions.runPendingTask}
                        onDeletePending={taskActions.deletePendingTask}
                        onOpenWorkDir={taskActions.openTaskWorkDir}
                        onListResultDiff={taskActions.listTaskResultDiff}
                        onGetResultDiffFile={taskActions.getTaskResultDiffFile}
                        onMerge={taskActions.mergeResult}
                        onCheckResultBranch={taskActions.checkResultBranch}
                        onRefreshResultBranch={taskActions.refreshResultBranch}
                        onCreateResultPr={async (input) => {
                          await taskActions.createResultPr(input)
                        }}
                        mockQueueEnabled={state.mockQueueEnabled}
                        errorJumpSignal={errorJump}
                        composerDockVisible={composerVisible && tasksVisible}
                        onAddTask={() => setPanelVisible('composer', !composerVisible)}
                        addTaskActive={composerVisible}
                        onClose={() => setPanelVisible('tasks', false)}
                      />
                    </div>
                  ) : null}

                  <div
                    className="flex min-h-0 flex-col overflow-hidden"
                    style={{ gridColumn: tasksVisible ? 2 : 1 }}
                  >
                    {selectedTask ? (
                      <DetailPanel
                        key={selectedTask.id}
                        className="h-full min-h-0"
                        task={selectedTask}
                        tasks={state.tasks}
                        results={state.results}
                        workflows={state.workflows}
                        executors={state.executors}
                        chains={state.chains}
                        composerDockVisible={composerVisible && !tasksVisible}
                        onSelectTask={taskActions.selectTask}
                        onBack={taskActions.clearSelection}
                        onCreateChain={() => onRequestCreateChain(selectedTask)}
                        onMaterializeChain={(input) => void onMaterializeChain(input)}
                        onUnlinkChainEdge={(chainId, edge) => void onUnlinkChainEdge(chainId, edge)}
                        chainMaterializeBusy={chainMaterializeBusy}
                        chainMaterializeWarning={chainMaterializeWarning}
                        onOpenExecutionLog={openExecutionLog}
                        onOpenDecisions={(task) => openDecisionsForTask(task.id)}
                        onRequestRetryAction={onRequestRetryAction}
                        onRunPending={taskActions.runPendingTask}
                        onDeletePending={taskActions.deletePendingTask}
                        onOpenWorkDir={taskActions.openTaskWorkDir}
                        onStopRunning={taskActions.stopTask}
                        onResumeStopped={
                          state.mockQueueEnabled ? taskActions.resumeStoppedTask : undefined
                        }
                        conversationChatEnabled
                        onContinueInChat={handleContinueTaskInChat}
                      />
                    ) : (
                      <OverviewPanel
                        className="h-full min-h-0"
                        tasks={state.tasks}
                        retries={state.retries}
                        results={state.results}
                        chains={state.chains}
                        workflows={state.workflows}
                        executorsIdle={executorsIdle}
                        executorsTotal={state.executors.length}
                        composerDockVisible={composerVisible && !tasksVisible}
                        onSelectTask={taskActions.selectTask}
                        onJumpErrorTab={() => {
                          setPanelVisible('tasks', true)
                          setErrorJump((n) => n + 1)
                        }}
                        onOpenSettings={onOpenSettings}
                      />
                    )}
                  </div>

                  {composerVisible ? (
                    <FloatingPanel
                      storageKey="composer"
                      defaultWidth={440}
                      minWidth={380}
                      minHeight={280}
                    >
                      <PromptComposer
                        className="h-full min-h-0"
                        workflows={composerWorkflows}
                        history={promptHistory}
                        selectedWorkflow={selectedWorkflow}
                        recentWorkflowNames={recentWorkflowNames}
                        cliReady={cliReady}
                        cliGuidance={cliGuidance ?? undefined}
                        builtinWorkflowCategoryOrder={state.builtinWorkflowCategoryOrder}
                        allowedProviders={allowedProviders}
                        sddOpen={state.sddOpen}
                        workspacePath={state.workspace.path}
                        sddOpenBannerVisible={
                          state.sddOpen != null && state.sddOpen.recommendedEntry !== 'dashboard'
                        }
                        onWorkflowChange={selectWorkflowForComposer}
                        onSubmit={async (draft) => {
                          const optimisticTaskId = addOptimisticComposerTask(draft)
                          try {
                            await taskActions.enqueueTask(draft)
                            void onRefreshPromptHistory().catch(() => undefined)
                          } finally {
                            removeOptimisticComposerTask(optimisticTaskId)
                          }
                        }}
                        onRunNow={async (draft) => {
                          const optimisticTaskId = addOptimisticComposerTask(draft)
                          try {
                            await taskActions.runTaskNow(draft)
                            void onRefreshPromptHistory().catch(() => undefined)
                          } finally {
                            removeOptimisticComposerTask(optimisticTaskId)
                          }
                        }}
                        onDeleteHistory={(id) =>
                          void taskActions
                            .deletePromptHistoryItem(id)
                            .then(() => onRefreshPromptHistory())
                        }
                        onNewWorkflow={onNewWorkflow}
                        onClose={() => setPanelVisible('composer', false)}
                        onWorkflowCopied={() => workspaceActions.refreshWorkflows()}
                      />
                    </FloatingPanel>
                  ) : null}
                </div>
              ) : null}

              <div
                className={cn(
                  displayedView === 'workflow'
                    ? 'flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60 p-4'
                    : 'hidden',
                )}
              >
                <WorkflowEditor
                  workflows={state.workflows}
                  builtinWorkflowCategoryOrder={state.builtinWorkflowCategoryOrder}
                  onRefresh={workspaceActions.refreshWorkflows}
                  createRequest={workflowCreateRequest}
                  onEditInFacets={(selection) => void onOpenSettingsToFacets(selection)}
                  catalogWorkflowFilter={workflowCatalogFilter}
                  catalogWorkflowFilterLabel={workflowCatalogFilterLabel}
                  onClearCatalogWorkflowFilter={() => {
                    setWorkflowCatalogFilter(null)
                    setWorkflowCatalogFilterLabel(null)
                  }}
                />
              </div>

              {displayedView === 'adapter' ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
                  <AdapterView
                    agents={state.agents}
                    executors={state.executors}
                    integrations={state.integrations}
                    onOpenSettings={onOpenSettingsToIntegrations}
                  />
                </div>
              ) : null}

              {displayedView === 'log' ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
                  <ExecutionLogView
                    executors={state.executors}
                    onOpenTask={(taskId) => {
                      setActiveView('task')
                      taskActions.selectTask(taskId)
                    }}
                  />
                </div>
              ) : null}

              {displayedView === 'summary' ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
                  <ExecutionSummaryView />
                </div>
              ) : null}

              {displayedView === 'decisions' ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
                  <DecisionsView
                    onOpenTask={(taskId) => {
                      setActiveView('task')
                      taskActions.selectTask(taskId)
                    }}
                    requestConfirm={requestConfirm}
                    onEnqueueTask={async (draft) => {
                      await taskActions.enqueueTask({
                        body: draft.body,
                        workflowMode: 'manual',
                        workflow: selectedWorkflow,
                      })
                      void onRefreshPromptHistory().catch(() => undefined)
                    }}
                  />
                </div>
              ) : null}

              {displayedView === 'spec-studio' ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
                  <SpecStudio
                    tasks={state.tasks}
                    currentWorkspacePath={state.workspace.path}
                    allowedProviders={allowedProviders}
                    recentWorkspaces={recentWorkspaces}
                    onChangeWorkspace={onChangeWorkspace}
                    onOpenRecentWorkspace={onOpenRecentWorkspace}
                    onRemoveRecentWorkspace={onRemoveRecentWorkspace}
                    onEnqueueSpec={async (draft) => {
                      const optimisticTaskId = addOptimisticComposerTask(draft)
                      try {
                        await taskActions.enqueueTask(draft)
                        void onRefreshPromptHistory().catch(() => undefined)
                      } finally {
                        removeOptimisticComposerTask(optimisticTaskId)
                      }
                    }}
                    onRunNowSpec={async (draft) => {
                      const optimisticTaskId = addOptimisticComposerTask(draft)
                      try {
                        await taskActions.runTaskNow(draft)
                        void onRefreshPromptHistory().catch(() => undefined)
                      } finally {
                        removeOptimisticComposerTask(optimisticTaskId)
                      }
                    }}
                  />
                </div>
              ) : null}

              {displayedView === 'issue' ? (
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
                  <IssueTab
                    workspacePath={state.workspace.path}
                    workflows={userVisibleWorkflows}
                    builtinWorkflowCategoryOrder={state.builtinWorkflowCategoryOrder}
                    recentWorkflowNames={recentWorkflowNames}
                    pendingCount={pendingTaskCount}
                    onNewWorkflow={onNewWorkflow}
                    onWorkflowCopied={() => workspaceActions.refreshWorkflows()}
                  />
                </div>
              ) : null}
            </main>
          </div>
        </div>

        <PanelRestoreStrip closed={closedPanels} onRestore={(id) => setPanelVisible(id, true)} />

        <SettingsModal
          open={settingsOpen}
          workspacePath={state.workspace.path}
          taktExecutionPath={state.workspace.taktExecutionPath}
          config={settingsConfig}
          agents={state.agents}
          integrations={state.integrations}
          initialTab={settingsInitialTab}
          initialFacetSelection={settingsInitialFacetSelection}
          onNavigateToWorkflowView={async (filter) => {
            if (filter?.key) {
              try {
                const usage = await workspaceActions.listFacetUsages({
                  kind: filter.kind,
                  key: filter.key,
                })
                setWorkflowCatalogFilter(new Set(usage.workflowNames))
                setWorkflowCatalogFilterLabel(`${filter.kind}/${filter.key}`)
              } catch {
                setWorkflowCatalogFilter(null)
                setWorkflowCatalogFilterLabel(null)
              }
            } else {
              setWorkflowCatalogFilter(null)
              setWorkflowCatalogFilterLabel(null)
            }
            onCloseSettings()
            setActiveView('workflow')
          }}
          onClose={onCloseSettings}
          onSaved={() => void onSettingsSaved()}
          hookBearerSecret={hookBearerSecret}
          onDismissHookBearerSecret={onDismissHookBearerSecret}
          onToggleHookServer={onToggleHookServer}
          onToggleAdapter={onToggleAdapter}
          onPushAdapter={onPushAdapter}
          onSelectWorkspace={onChangeWorkspace}
        />

        <RetryActionDialog
          open={retryDialog.open}
          action={retryDialog.action}
          task={retryDialog.task}
          busy={retryBusy}
          onClose={onCloseRetryDialog}
          onConfirm={onConfirmRetryAction}
        />

        <ChainCreateDialog
          open={chainDialog.open}
          origin={chainDialog.origin}
          workflows={state.workflows}
          busy={chainBusy}
          onClose={onCloseChainDialog}
          onConfirm={onConfirmChainCreate}
        />

        {confirmDialog}
      </div>
    </SkinProvider>
  )
}
