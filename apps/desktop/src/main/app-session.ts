import {
  type AgentOverrides,
  type AgentOverridesUpdateInput,
  type AppState,
  type CanonicalImportOffer,
  type ChainEdgeStatus,
  type ChainMaterializeResult,
  type ChatComposerDraftSaveInput,
  type ChatSessionApplyChangesInput,
  type ChatSessionApplyChangesResult,
  type ChatSessionPendingChangeFileInput,
  type ChatSessionPendingChangeFileResult,
  type ChatSessionPendingChangesResult,
  type ChatToTaskMetricRecordInput,
  type ComposerAssistActiveSession,
  type ComposerAssistantFinalizeResult,
  type ComposerAssistantTurn,
  type ComposerSessionAcceptInput,
  type ComposerSessionCancelInput,
  type ComposerSessionFinalizeInput,
  type ComposerSessionInterruptInput,
  type ComposerSessionMessageInput,
  type ComposerSessionPlayInput,
  type ComposerSessionResumeInput,
  type ComposerSessionStartInput,
  type ComposerSourceContextBuildInput,
  type ConnectionState,
  type ConversationHistoryDeleteInput,
  type ConversationHistoryGetInput,
  type ConversationHistoryListInput,
  type ConversationHistorySearchInput,
  type CreateResultPrInput,
  type CreateResultPrResult,
  computeSpecThreadCounts,
  type DecidedIntentSaveInput,
  type DecidedIntentThreadInput,
  type EngineConfig,
  type EngineConfigUpdateInput,
  type EnqueueTaskBridgeInput,
  type EnqueueTaskInput,
  type EnqueueTaskResult,
  type ExecutionCatalog,
  type ExecutionLogListResult,
  type ExecutionLogQuery,
  type ExecutionProfile,
  type ExecutionSummary,
  type ExecutionSummaryGetInput,
  type GitHubIssueFetchInput,
  type GitHubIssueListOpenInput,
  type GitHubIssueListOpenResult,
  type GitHubIssueView,
  type IntegrationAdapterId,
  type IntegrationsState,
  type IntentDraftGenerateInput,
  type IntentDraftSaveInput,
  type IntentDraftThreadInput,
  type IntentLedgerAdoptInput,
  type IntentLedgerEntry,
  type IntentLedgerFixInput,
  type IntentLedgerGetSummaryInput,
  type IntentLedgerListByThreadInput,
  type IntentLedgerListPendingInput,
  IPC_CHANNELS,
  isPlanetzMockEnabled,
  isSddOpenKiroCacheStale,
  type KiroRoutingContext,
  type KiroSpecGetInput,
  type KiroSpecSummary,
  type ListProviderEffortsInput,
  type ListProviderModelsInput,
  type OllamaExecutionGuardPreviewInput,
  type OllamaExecutionGuardPreviewResult,
  type OllamaHealthGetInput,
  type OrbitInteractiveStreamLine,
  type RecentWorkspace,
  type ResultCheckBranchResult,
  ROUTING_GROUPS,
  type RunEvent,
  resolveExecutionProfile,
  resolveKiroRoutingContextFromSpecs,
  resolveSpecThreadPhase,
  type SddOpenSnapshot,
  type SettingsUpdateInput,
  type SpecThreadLedgerFact,
  type SpecThreadSummary,
  type SpecThreadSummaryListInput,
  type TaskResultBundle,
  type TaskResultDiffFile,
  type TaskResultDiffSummary,
  type TaskResultPathOpenInput,
  type TaskSupplyTraceItem,
  type TaskViewModel,
  type UiConfig,
  type UiState,
  type WorkspaceBootstrapStatus,
  type YamlOpenInput,
} from '@planetz/shared'
import type { BrowserWindow } from 'electron'
import { HookServerStartError } from './integrations/hook-server-errors.js'
import { IntegrationsService } from './integrations/integrations-service.js'
import { isMockQueueMode } from './lib/mock-queue-mode.js'
import type { PendingRunNowAttribution } from './lib/run-now-attribution-backfill.js'
import { TaskFailureNotificationTracker } from './lib/task-failure-notification-tracker.js'
import {
  buildResolveTaskResultInput,
  taskResultInputSourceFromSession,
} from './lib/task-result-input.js'
import { openTaskResultPath as openTaskResultPathOnDisk } from './lib/task-result-path-open.js'
import { resolveTaskResultBundle } from './lib/task-result-service.js'
import { openTaskWorkDir as openTaskWorkDirOnDisk } from './lib/task-work-dir.js'
import { tickMockTasks } from './mock/animator.js'
import { ChainMockStore } from './mock/chain-mock-store.js'
import { MOCK_CHAINS, MOCK_TASKS } from './mock/mock-data.js'
import { WorkflowMockManager } from './mock/workflow-mock-manager.js'
import { MOCK_WORKFLOWS } from './mock/workflows-mock.js'
import { AgentOverridesStore } from './planetz/agent-overrides-store.js'
import {
  isHeadlessInteractiveRunnerReady,
  resolveComposerAssistStartMode,
} from './planetz/composer-assist-capabilities.js'
import { DecidedIntentContextWriter } from './planetz/decided-intent-context-writer.js'
import { EffortHistoryTracker } from './planetz/effort-history-tracker.js'
import { EngineConfigStore } from './planetz/engine-config-store.js'
import { EstablishedDecisionsWriter } from './planetz/established-decisions-writer.js'
import { listExecutionLog } from './planetz/execution-log-service.js'
import { computeExecutionSummary } from './planetz/execution-summary-service.js'
import { generateIntentDraftFromConversation } from './planetz/intent-draft-generator.js'
import { IntentLedgerIngestService } from './planetz/intent-ledger-ingest-service.js'
import { IntentLedgerTracker } from './planetz/intent-ledger-tracker.js'
import type { IsolatedTaktWorkspace } from './planetz/isolated-takt-workspace.js'
import { KiroSpecStore } from './planetz/kiro-spec-store.js'
import {
  configureDefaultLocalLlmService,
  getDefaultLocalLlmService,
} from './planetz/local-llm/local-llm-service.js'
import { McpConfigService } from './planetz/mcp-config-service.js'
import { ModelHistoryTracker } from './planetz/model-history-tracker.js'
import { OllamaHealthMonitor } from './planetz/ollama-health-monitor.js'
import { ProviderEffortsService } from './planetz/provider-efforts-service.js'
import { ProviderModelsService } from './planetz/provider-models-service.js'
import { RequirementIntentLinkIngestService } from './planetz/requirement-intent-link-ingest-service.js'
import { RequirementsPromotionService } from './planetz/requirements-promotion-service.js'
import { buildSddOpenSnapshot } from './planetz/sdd-open-snapshot-service.js'
import { SpecApprovalIngestService } from './planetz/spec-approval-ingest-service.js'
import { readTaktProjectConfig } from './planetz/takt-import-sources.js'
import { ValidationCoverageService } from './planetz/validation-coverage-service.js'
import type { PlanetzWorkflowCanonicalManager } from './planetz/workflow-canonical-manager.js'
import type { WorkflowRoutingCatalogStore } from './planetz/workflow-routing-catalog.js'
import { openPlanetzYaml } from './planetz/yaml-open-service.js'
import { ChainCoordinator } from './session/chain-coordinator.js'
import {
  ChainWorkflowService,
  type CreateChainTaskInput,
} from './session/chain-workflow-service.js'
import {
  registerChatApplySessionMeta,
  unregisterChatApplySessionMeta,
} from './session/chat-apply-session-registry.js'
import { ChatSessionApplyService } from './session/chat-session-apply-service.js'
import { ComposerAssistantService } from './session/composer-assistant-service.js'
import { ComposerConversationLedgerWriter } from './session/composer-conversation-ledger.js'
import { buildComposerSourceContext } from './session/composer-source-context-builder.js'
import { ConversationHistoryService } from './session/conversation-history-service.js'
import { GitHubIssueService } from './session/github-issue-service.js'
import { ResultDiffService } from './session/result-diff-service.js'
import { SessionConfigExecutionService } from './session/session-config-execution-service.js'
import { SessionSettingsService } from './session/session-settings-service.js'
import { SessionWorkflowImportService } from './session/session-workflow-import-service.js'
import { StateRefreshCoordinator } from './session/state-refresh-coordinator.js'
import { TaskCatalog } from './session/task-catalog.js'
import { TaskCommandService } from './session/task-command-service.js'
import { TaskPrService } from './session/task-pr-service.js'
import { WorkflowRoutingFeatureCache } from './session/workflow-auto/routing-feature-cache.js'
import { WorkspaceRuntimeService } from './session/workspace-runtime-service.js'
import { ChainFileStore } from './sidecar/chain-store.js'
import { ChatComposerDraftStore } from './sidecar/chat-composer-draft-store.js'
import { ChatToTaskMetricsStore } from './sidecar/chat-to-task-metrics-store.js'
import { ComposerAssistMetricsStore } from './sidecar/composer-assist-metrics-store.js'
import { ComposerSessionStore } from './sidecar/composer-session-store.js'
import { ConversationLedgerStore } from './sidecar/conversation-ledger-store.js'
import { ConversationStore } from './sidecar/conversation-store.js'
import { DecidedIntentStore } from './sidecar/decided-intent-store.js'
import { EffortHistoryStore } from './sidecar/effort-history-store.js'
import { IntentDraftStore } from './sidecar/intent-draft-store.js'
import { type IntentLedgerRecord, IntentLedgerStore } from './sidecar/intent-ledger-store.js'
import { MockQueueStore } from './sidecar/mock-queue-store.js'
import { ModelHistoryStore } from './sidecar/model-history-store.js'
import { PromptHistoryStore } from './sidecar/prompt-history-store.js'
import { RequirementIntentLinkStore } from './sidecar/requirement-intent-link-store.js'
import { RetryContextStore } from './sidecar/retry-context-store.js'
import { type SidecarPaths, SidecarStore } from './sidecar/sidecar-store.js'
import { TaskIntentContextSnapshotStore } from './sidecar/task-intent-context-snapshot-store.js'
import { TaskPrLinkStore } from './sidecar/task-pr-link-store.js'
import { TaskSupplySnapshotStore } from './sidecar/task-supply-snapshot-store.js'
import { TaskThreadLinkStore } from './sidecar/task-thread-link-store.js'
import { WorkspaceSessionStore } from './sidecar/workspace-session-store.js'
import { intentLedgerRecordToEntry } from './storage/sqlite/repositories/intent-ledger-repository.js'
import type { TaktConnectorCli } from './takt/connector-cli.js'
import type { WatchManager } from './takt/watch-manager.js'

export type { CreateChainTaskInput } from './session/chain-workflow-service.js'

const STARTUP_RESTORE_WAIT_TIMEOUT_MS = 15_000

export type StartupRestoreWaitOutcome = 'not_pending' | 'settled' | 'timed_out'

function waitForPromiseWithTimeout(
  promise: Promise<void>,
  timeoutMs: number,
): Promise<StartupRestoreWaitOutcome> {
  return new Promise<StartupRestoreWaitOutcome>((resolve) => {
    let done = false
    const finish = (outcome: StartupRestoreWaitOutcome) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(outcome)
    }
    const timer = setTimeout(() => finish('timed_out'), timeoutMs)
    void promise.then(
      () => finish('settled'),
      () => finish('settled'),
    )
  })
}

/**
 * Facade for workspace lifecycle, task commands, and state projection.
 * Public fields marked below are the mutable surface for session/* services (ports), not renderer API.
 * New domain logic belongs in session/* services — see docs/policies/app-session-facade-policy.md.
 */
export class AppSession {
  private mainWindowGetter: () => BrowserWindow | null = () => null

  workspacePath: string | null = null
  isolatedTaktWorkspace: IsolatedTaktWorkspace | null = null
  sidecarPaths: SidecarPaths | null = null
  config: UiConfig | null = null
  uiState: UiState = {}
  connection: ConnectionState = { cli: 'unknown', watch: 'unknown' }
  mockTasks = [...MOCK_TASKS]
  bootstrapOverride: WorkspaceBootstrapStatus | null = null
  readonly workflowMockManager = new WorkflowMockManager()
  readonly chainMockStore = new ChainMockStore()

  /** @internal WorkspaceRuntimePort */
  canonicalWorkflowManager: PlanetzWorkflowCanonicalManager | null = null
  workflowRoutingCatalogStore: WorkflowRoutingCatalogStore | null = null
  readonly engineConfigStore = new EngineConfigStore()
  readonly agentOverridesStore = new AgentOverridesStore()
  /** @internal WorkspaceRuntimePort */
  connector: TaktConnectorCli | null = null
  /** @internal WorkspaceRuntimePort */
  watchManager: WatchManager | null = null
  /** @internal StateRefreshPort */
  cachedState: AppState | null = null
  /** Kiro specs loaded during the latest SDD snapshot rebuild (same refresh cycle). */
  private kiroSpecsCache: { workspacePath: string; specs: KiroSpecSummary[] } | null = null
  private cachedSddOpen: { workspacePath: string; snapshot: SddOpenSnapshot } | null = null
  /** @internal StateRefreshPort — reused by execution analytics IPC (filled on refresh). */
  cachedRunEvents: RunEvent[] = []
  /** @internal StateRefreshPort — backfill taskAssignments after run-now creates a running task */
  pendingRunNowAttribution: PendingRunNowAttribution | null = null
  /** @internal WorkspaceRuntimePort */
  canonicalImportOffer: CanonicalImportOffer | null = null
  /** @internal WorkspaceRuntimePort */
  stopRunsWatcher: (() => void) | null = null
  private onStateChange: (() => void) | null = null
  /**
   * In-flight startup workspace restore. Renderer reads (`workspace:get`) await
   * this so the onboarding wizard never flashes before the restore settles.
   */
  private startupSettled: Promise<void> | null = null

  readonly sidecarStore = new SidecarStore()
  readonly integrationsService = new IntegrationsService(this.sidecarStore)
  readonly promptHistoryStore = new PromptHistoryStore()
  readonly chatComposerDraftStore = new ChatComposerDraftStore()
  readonly chatToTaskMetricsStore = new ChatToTaskMetricsStore()
  readonly taskPrLinkStore = new TaskPrLinkStore()
  readonly intentLedgerStore = new IntentLedgerStore()
  readonly taskThreadLinkStore = new TaskThreadLinkStore()
  readonly taskSupplySnapshotStore = new TaskSupplySnapshotStore()
  readonly requirementIntentLinkStore = new RequirementIntentLinkStore()
  readonly taskIntentContextSnapshotStore = new TaskIntentContextSnapshotStore()
  readonly decidedIntentStore = new DecidedIntentStore()
  readonly intentDraftStore = new IntentDraftStore()
  readonly modelHistoryStore = new ModelHistoryStore()
  readonly effortHistoryStore = new EffortHistoryStore()
  readonly intentLedgerIngestService = new IntentLedgerIngestService(this.intentLedgerStore)
  readonly requirementIntentLinkIngestService = new RequirementIntentLinkIngestService(
    this.requirementIntentLinkStore,
    this.taskIntentContextSnapshotStore,
  )
  readonly modelHistoryTracker = new ModelHistoryTracker(this.modelHistoryStore)
  readonly effortHistoryTracker = new EffortHistoryTracker(this.effortHistoryStore)
  readonly intentLedgerTracker = new IntentLedgerTracker(
    this.intentLedgerIngestService,
    this.intentLedgerStore,
    {
      service: this.requirementIntentLinkIngestService,
      store: this.requirementIntentLinkStore,
    },
    () => this.invalidateSddOpenSnapshot(),
  )
  readonly taskFailureNotificationTracker = new TaskFailureNotificationTracker()
  readonly establishedDecisionsWriter = new EstablishedDecisionsWriter(this.intentLedgerStore)
  readonly decidedIntentContextWriter = new DecidedIntentContextWriter(
    this.decidedIntentStore,
    this.taskThreadLinkStore,
    this.taskIntentContextSnapshotStore,
  )
  readonly requirementsPromotionService = new RequirementsPromotionService(this.intentLedgerStore)
  readonly kiroSpecStore = new KiroSpecStore()
  readonly specApprovalIngestService = new SpecApprovalIngestService(
    this.intentLedgerStore,
    this.kiroSpecStore,
  )
  readonly providerModelsService = new ProviderModelsService(this.modelHistoryStore)
  readonly ollamaHealthMonitor: OllamaHealthMonitor
  readonly providerEffortsService = new ProviderEffortsService(this.effortHistoryStore)
  readonly mockQueueStore = new MockQueueStore()
  readonly conversationStore = new ConversationStore()
  readonly conversationLedgerStore = new ConversationLedgerStore()
  readonly validationCoverageService = new ValidationCoverageService(
    this.conversationLedgerStore,
    this.taskThreadLinkStore,
    this.decidedIntentStore,
    this.requirementIntentLinkStore,
    (taskId) => buildResolveTaskResultInput(taskResultInputSourceFromSession(this), taskId),
  )
  readonly retryContextStore = new RetryContextStore()
  readonly workspaceSessionStore = new WorkspaceSessionStore()
  readonly chainFileStore = new ChainFileStore()
  readonly taskCatalog = new TaskCatalog()
  readonly configExecution = new SessionConfigExecutionService(this)
  readonly settings = new SessionSettingsService(this)
  readonly workflowImports = new SessionWorkflowImportService(this)
  readonly chainCoordinator = new ChainCoordinator(
    () => this.mockQueueEnabled(),
    this.chainMockStore,
    this.chainFileStore,
  )
  readonly composerSessionStore = new ComposerSessionStore()
  readonly composerAssistMetricsStore = new ComposerAssistMetricsStore()
  readonly resultDiffService = new ResultDiffService()
  readonly mcpConfigService = new McpConfigService({
    requireWorkspacePath: () => this.requireWorkspacePath(),
    requireSidecarPaths: () => this.requireSidecarPaths(),
  })
  readonly chatSessionApplyService = new ChatSessionApplyService({
    requireWorkspacePath: () => this.requireWorkspacePath(),
    requireIsolatedRepoPath: () => this.workspaceRuntime.requireIsolatedRepoPath(),
    requireSidecarPaths: () => this.requireSidecarPaths(),
    ledgerStore: this.conversationLedgerStore,
  })
  readonly githubIssueService = new GitHubIssueService()
  readonly taskPrService = new TaskPrService(this.taskPrLinkStore)
  readonly composerConversationLedgerWriter = new ComposerConversationLedgerWriter({
    ledgerStore: this.conversationLedgerStore,
    requireSidecarPaths: () => this.requireSidecarPaths(),
  })
  readonly composerAssistantService = new ComposerAssistantService({
    resolveExecutionProfile: (input) => this.resolveExecutionProfileForInput(input),
    loadEffectiveEngineConfig: () => this.loadEffectiveEngineConfig(),
    requireTaktRepoPath: () => this.requireTaktRepoPath(),
    requireIsolatedRepoPath: () => this.workspaceRuntime.requireIsolatedRepoPath(),
    captureChatApplyBaseRef: () => this.workspaceRuntime.captureChatApplyBaseRef(),
    registerChatApplySessionMeta,
    unregisterChatApplySessionMeta,
    resolveMcpServersForAgent: (providerId) =>
      this.mcpConfigService.resolveMcpServersForAgent(providerId),
    resolveMcpAllowedToolsForAgent: (providerId) =>
      this.mcpConfigService.resolveMcpAllowedToolsForAgent(providerId),
    requireSidecarPaths: () => this.requireSidecarPaths(),
    sessionStore: this.composerSessionStore,
    metricsStore: this.composerAssistMetricsStore,
    conversationLedgerWriter: this.composerConversationLedgerWriter,
    conversationLedgerStore: this.conversationLedgerStore,
    emitComposerStream: (line) => this.emitComposerStream(line),
  })
  readonly conversationHistoryService = new ConversationHistoryService({
    requireWorkspacePath: () => this.requireWorkspacePath(),
    requireSidecarPaths: () => this.requireSidecarPaths(),
    ledgerStore: this.conversationLedgerStore,
  })

  private readonly chainWorkflow: ChainWorkflowService
  private readonly stateRefresh: StateRefreshCoordinator
  readonly workspaceRuntime: WorkspaceRuntimeService
  private readonly taskCommands: TaskCommandService
  readonly workflowRoutingFeatureCache = new WorkflowRoutingFeatureCache()

  constructor() {
    configureDefaultLocalLlmService({
      loadEffectiveEngineConfig: () => this.loadEffectiveEngineConfig(),
    })
    this.ollamaHealthMonitor = new OllamaHealthMonitor(getDefaultLocalLlmService())
    this.chainMockStore.seed(MOCK_CHAINS)
    this.stateRefresh = new StateRefreshCoordinator(this)
    this.workspaceRuntime = new WorkspaceRuntimeService(this)
    this.taskCommands = new TaskCommandService(this)
    this.chainWorkflow = new ChainWorkflowService({
      chainCoordinator: this.chainCoordinator,
      mockQueueStore: this.mockQueueStore,
      mockQueueEnabled: () => this.mockQueueEnabled(),
      getMockTasks: () => this.mockTasks,
      setMockTasks: (tasks) => {
        this.mockTasks = tasks
      },
      getConnector: () => this.connector,
      requireSidecarPaths: () => this.requireSidecarPaths(),
      requireWorkspacePath: () => this.requireWorkspacePath(),
      requireConfig: () => this.requireConfig(),
      listTasksForChain: () => this.listTasksForChain(),
      invalidateTaktTaskYamlCache: () => this.invalidateTaktTaskYamlCache(),
      taktTaskIdSet: (tasks) => this.taktTaskIdSet(tasks),
      onAfterChainMutation: async (selectedTaskId) => {
        if (selectedTaskId) {
          await this.settings.persistUiState({ selectedTaskId })
        }
        await this.stateRefresh.refreshState()
      },
    })
  }

  get taktExecutionPath(): string | null {
    return this.isolatedTaktWorkspace?.isolatedRepoPath ?? null
  }

  invalidateWorkflowRoutingCaches(): void {
    this.canonicalWorkflowManager?.invalidateListCache()
    this.workflowRoutingFeatureCache.invalidate()
  }

  /** @deprecated Use {@link invalidateWorkflowRoutingCaches} when canonical list cache should reset too. */
  invalidateWorkflowRoutingFeatureIndex(): void {
    this.workflowRoutingFeatureCache.invalidate()
  }

  async dispose(): Promise<void> {
    await this.workspaceRuntime.teardownWorkspaceRuntime()
  }

  setStateChangeListener(listener: () => void): void {
    this.onStateChange = listener
  }

  /** Records the startup workspace-restore promise so renderer reads can wait for it. */
  markStartupSettled(promise: Promise<void>): void {
    this.startupSettled = promise
  }

  /** Resolves once the startup workspace restore (if any) has settled, success or failure. */
  whenStartupSettled(): Promise<void> {
    return this.startupSettled ?? Promise.resolve()
  }

  async waitForStartupSettled(
    timeoutMs = STARTUP_RESTORE_WAIT_TIMEOUT_MS,
  ): Promise<StartupRestoreWaitOutcome> {
    if (!this.startupSettled) return 'not_pending'
    if (timeoutMs <= 0) {
      await this.startupSettled
      return 'settled'
    }
    return waitForPromiseWithTimeout(this.startupSettled, timeoutMs)
  }

  shouldRunMockAnimator(): boolean {
    return this.mockQueueEnabled() && this.connection.watch !== 'running'
  }

  mockQueueEnabled(): boolean {
    return isMockQueueMode({
      envMockEnabled: isPlanetzMockEnabled(),
      workspacePath: this.workspacePath,
      bootstrapOverride: this.bootstrapOverride,
    })
  }

  get workflowManager(): WorkflowMockManager | PlanetzWorkflowCanonicalManager {
    if (this.mockQueueEnabled() || !this.canonicalWorkflowManager) {
      return this.workflowMockManager
    }
    return this.canonicalWorkflowManager
  }

  async refreshAndNotify(): Promise<void> {
    await this.stateRefresh.refreshAndNotify(this.onStateChange ?? undefined)
  }

  getState(): AppState | null {
    return this.stateRefresh.getState()
  }

  async refreshState(): Promise<AppState> {
    return this.stateRefresh.refreshState()
  }

  clearKiroSpecsCache(): void {
    this.invalidateSddOpenSnapshot()
  }

  invalidateSddOpenSnapshot(): void {
    this.cachedSddOpen = null
    this.kiroSpecsCache = null
  }

  async getSddOpenSnapshot(): Promise<SddOpenSnapshot | null> {
    const workspacePath = this.workspacePath
    const paths = this.sidecarPaths
    if (!workspacePath || !paths) return null
    if (this.cachedSddOpen?.workspacePath === workspacePath) {
      const specs = await this.kiroSpecStore.listSpecs(workspacePath)
      this.kiroSpecsCache = { workspacePath, specs }
      if (isSddOpenKiroCacheStale(specs, this.cachedSddOpen.snapshot)) {
        return this.rebuildSddOpenSnapshot()
      }
      return this.cachedSddOpen.snapshot
    }
    return this.rebuildSddOpenSnapshot()
  }

  async rebuildSddOpenSnapshot(): Promise<SddOpenSnapshot | null> {
    const workspacePath = this.workspacePath
    const paths = this.sidecarPaths
    if (!workspacePath || !paths) return null
    try {
      const specs = await this.kiroSpecStore.listSpecs(workspacePath)
      this.kiroSpecsCache = { workspacePath, specs }
      const { snapshot } = await buildSddOpenSnapshot({
        workspacePath,
        sidecarPaths: paths,
        intentLedgerStore: this.intentLedgerStore,
        kiroSpecStore: this.kiroSpecStore,
        specApprovalIngest: this.specApprovalIngestService,
        specs,
      })
      this.cachedSddOpen = { workspacePath, snapshot }
      return snapshot
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[planetz] failed to build SDD open snapshot:', message)
      return null
    }
  }

  async resolveKiroRoutingContext(): Promise<KiroRoutingContext | null> {
    const workspacePath = this.workspacePath
    if (!workspacePath) return null
    const cached =
      this.kiroSpecsCache?.workspacePath === workspacePath ? this.kiroSpecsCache.specs : null
    const specs = cached ?? (await this.kiroSpecStore.listSpecs(workspacePath))
    return resolveKiroRoutingContextFromSpecs(specs)
  }

  async openWorkspace(workspacePath: string): Promise<AppState> {
    return this.workspaceRuntime.openWorkspace(workspacePath)
  }

  async openRecentWorkspace(path: string): Promise<{ path: string; state: AppState }> {
    return this.workspaceRuntime.openRecentWorkspace(path)
  }

  listRecentWorkspaces(): Promise<RecentWorkspace[]> {
    return this.workspaceRuntime.listRecentWorkspaces()
  }

  async removeRecentWorkspace(path: string): Promise<RecentWorkspace[]> {
    return this.workspaceRuntime.removeRecentWorkspace(path)
  }

  async openLastWorkspaceIfAvailable(): Promise<{ path: string; state: AppState } | null> {
    return this.workspaceRuntime.openLastWorkspaceIfAvailable()
  }

  async confirmCanonicalImport(input?: { importHomeGlobal?: boolean }): Promise<AppState> {
    return this.workspaceRuntime.confirmCanonicalImport(input)
  }

  async dismissCanonicalImport(): Promise<AppState> {
    return this.workspaceRuntime.dismissCanonicalImport()
  }

  bindMainWindow(getter: () => BrowserWindow | null): void {
    this.mainWindowGetter = getter
  }

  emitComposerStream(line: OrbitInteractiveStreamLine): void {
    const win = this.mainWindowGetter()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.composerSessionStream, line)
    }
  }

  emitUiFocusTask(taskId: string): void {
    const win = this.mainWindowGetter()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.uiFocusTask, taskId)
    }
  }

  broadcast(win: BrowserWindow | null): void {
    const state = this.getState()
    if (state && win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.stateUpdate, state)
    }
  }

  async setBootstrapOverride(status: WorkspaceBootstrapStatus): Promise<AppState> {
    return this.workspaceRuntime.setBootstrapOverride(status)
  }

  async syncRuntimeWatchers(): Promise<void> {
    return this.workspaceRuntime.syncRuntimeWatchers()
  }

  async refreshConnection(): Promise<ConnectionState> {
    return this.workspaceRuntime.refreshConnection()
  }

  async initializeWorkspace(createTaktDir: boolean): Promise<AppState> {
    return this.workspaceRuntime.initializeWorkspace(createTaktDir)
  }

  async startWatch(): Promise<ConnectionState> {
    return this.workspaceRuntime.startWatch()
  }

  async stopWatch(): Promise<ConnectionState> {
    return this.workspaceRuntime.stopWatch()
  }

  getConfig(): UiConfig | null {
    return this.config
  }

  async updateConfig(patch: SettingsUpdateInput): Promise<UiConfig> {
    return this.settings.updateConfig(patch)
  }

  async persistUiState(patch: Partial<UiState>): Promise<void> {
    return this.settings.persistUiState(patch)
  }

  syncUiState(state: UiState): void {
    this.settings.syncUiState(state)
  }

  loadProjectionContext(): Promise<{
    engine: EngineConfig
    agentOverrides: AgentOverrides
    pendingProfilesByTaskId: ReadonlyMap<string, ExecutionProfile>
  }> {
    return this.configExecution.loadProjectionContext()
  }

  setPendingRunNowAttribution(pending: PendingRunNowAttribution | null): void {
    this.pendingRunNowAttribution = pending
  }

  async enqueueTask(input: EnqueueTaskBridgeInput): Promise<EnqueueTaskResult> {
    const result = await this.taskCommands.enqueueTask(input)
    await this.linkTaskToSourceThread(input, result)
    return result
  }

  async runTaskNow(input: EnqueueTaskBridgeInput): Promise<EnqueueTaskResult> {
    const result = await this.taskCommands.runTaskNow(input, this.connector)
    await this.linkTaskToSourceThread(input, result)
    return result
  }

  /** Best-effort: persist task<->originating thread link for Spec Studio traceability. */
  private async linkTaskToSourceThread(
    input: EnqueueTaskBridgeInput,
    result: EnqueueTaskResult,
  ): Promise<void> {
    const threadId = input.sourceThreadId
    const taskId = result.taskId
    const paths = this.sidecarPaths
    if (!threadId || !taskId || !paths) return
    await this.taskThreadLinkStore.link(paths, taskId, threadId)
  }

  async listAvailableWorkflowNames(): Promise<string[]> {
    const workflows = await this.listWorkflowSummaries()
    return workflows.map((workflow) => workflow.name)
  }

  async listWorkflowSummaries(): Promise<
    Array<{ name: string; source: import('@planetz/shared').WorkflowSource }>
  > {
    if (this.mockQueueEnabled()) {
      return MOCK_WORKFLOWS.map((workflow) => ({
        name: workflow.name,
        source: workflow.source,
      }))
    }
    if (this.canonicalWorkflowManager) {
      const workflows = await this.canonicalWorkflowManager.list()
      return workflows.map((workflow) => ({ name: workflow.name, source: workflow.source }))
    }
    return [{ name: 'default', source: 'builtin' }]
  }

  async loadWorkflowRoutingCatalog() {
    if (this.workflowRoutingCatalogStore) {
      return this.workflowRoutingCatalogStore.load()
    }
    return {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [],
    }
  }

  async runPendingTask(taskId: string): Promise<void> {
    return this.taskCommands.runPendingTask(taskId, this.connector)
  }

  async listTaskResultDiff(taskId: string, branch: string): Promise<TaskResultDiffSummary> {
    return this.resultDiffService.listTaskResultDiff(
      {
        taktRepoPath: this.requireTaktRepoPath(),
        config: this.requireConfig(),
      },
      { taskId, branch },
    )
  }

  async getChatSessionPendingChanges(
    threadId: string,
    expectedSessionId?: string,
  ): Promise<ChatSessionPendingChangesResult> {
    return this.chatSessionApplyService.getPendingChanges(threadId, expectedSessionId)
  }

  async getChatSessionPendingChangeFile(
    input: ChatSessionPendingChangeFileInput,
  ): Promise<ChatSessionPendingChangeFileResult> {
    return this.chatSessionApplyService.getPendingChangeFile(
      input.threadId,
      input.path,
      input.expectedSessionId,
    )
  }

  async applyChatSessionChanges(
    input: ChatSessionApplyChangesInput,
  ): Promise<ChatSessionApplyChangesResult> {
    return this.chatSessionApplyService.applyChanges(input)
  }

  listChatMcpPendingConsent(): Promise<string[]> {
    return this.mcpConfigService.listPendingMcpConsentServers()
  }

  grantChatMcpConsent(serverId: string): Promise<void> {
    return this.mcpConfigService.grantMcpConsent(serverId)
  }

  listChatMcpServersOverview() {
    return this.mcpConfigService.listMcpServersOverview()
  }

  setChatMcpSecret(secretName: string, secretValue: string) {
    return this.mcpConfigService.setMcpSecret(secretName, secretValue)
  }

  async getTaskResultDiffFile(
    taskId: string,
    branch: string,
    path: string,
  ): Promise<TaskResultDiffFile> {
    return this.resultDiffService.getTaskResultDiffFile(
      {
        taktRepoPath: this.requireTaktRepoPath(),
        config: this.requireConfig(),
      },
      { taskId, branch, path },
    )
  }

  async mergeResult(_taskId: string, branch: string): Promise<string> {
    if (!this.connector) throw new Error('No workspace open')
    return this.connector.mergeResult(branch)
  }

  async createResultPr(input: CreateResultPrInput): Promise<CreateResultPrResult> {
    return this.taskPrService.create(this.taskPrContext(), input)
  }

  async checkResultBranch(_taskId: string, branch: string): Promise<ResultCheckBranchResult> {
    return this.taskPrService.checkBranch(this.taskPrContext(), branch)
  }

  private taskPrContext() {
    return {
      mockQueueEnabled: () => this.mockQueueEnabled(),
      requireTaktRepoPath: () => this.requireTaktRepoPath(),
      requireSidecarPaths: () => this.requireSidecarPaths(),
      readTaktTasksFresh: () => this.readTaktTasksFresh(),
      readTaskResultBundle: async (taskId: string) => {
        try {
          return await this.getTaskResult(taskId)
        } catch {
          return null
        }
      },
      readTaktProjectConfigYaml: async () => {
        try {
          return await readTaktProjectConfig(this.requireTaktRepoPath(), this.requireConfig())
        } catch {
          return null
        }
      },
    }
  }

  retryTask(taskId: string) {
    return this.taskCommands.retryTask(taskId)
  }

  resumeTask(taskId: string, prompt: string) {
    return this.taskCommands.resumeTask(taskId, prompt)
  }

  async stopTask(taskId: string): Promise<void> {
    return this.taskCommands.stopTask(taskId)
  }

  async resumeStoppedTask(taskId: string): Promise<void> {
    return this.taskCommands.resumeStoppedTask(taskId)
  }

  reviseTask(taskId: string, prompt: string) {
    return this.taskCommands.reviseTask(taskId, prompt)
  }

  advanceMockTimeline(): void {
    const workflows =
      this.cachedState?.workflows && this.cachedState.workflows.length > 0
        ? this.cachedState.workflows
        : MOCK_WORKFLOWS
    const stepNamesByWorkflow = new Map(workflows.map((w) => [w.name, w.stepNames] as const))
    this.mockTasks = tickMockTasks(this.mockTasks, { stepNamesByWorkflow })
  }

  async deleteTask(taskId: string): Promise<void> {
    return this.taskCommands.deleteTask(taskId)
  }

  async createChainTask(
    input: CreateChainTaskInput,
  ): Promise<{ chainId: string; taskId?: string }> {
    return this.chainWorkflow.createChainTask(input)
  }

  async materializeChainEdge(input: {
    chainId: string
    fromTaskId: string
  }): Promise<ChainMaterializeResult> {
    return this.chainWorkflow.materializeChainEdge(input)
  }

  async checkChainSourceBranch(branch: string): Promise<{ exists: boolean }> {
    return this.chainWorkflow.checkSourceBranch(branch)
  }

  async removeChain(chainId: string, edgeKey?: string): Promise<void> {
    return this.chainWorkflow.removeChain(chainId, edgeKey)
  }

  async setChainEdgeStatus(
    chainId: string,
    fromTaskId: string,
    toTaskId: string | undefined,
    status: ChainEdgeStatus,
  ): Promise<void> {
    return this.chainWorkflow.setChainEdgeStatus(chainId, fromTaskId, toTaskId, status)
  }

  async listConversations(taskId: string) {
    return this.taskCommands.listConversations(taskId)
  }

  async getTaskResult(taskId: string): Promise<TaskResultBundle> {
    if (this.mockQueueEnabled()) {
      return {
        taskId,
        runsDirRel: this.requireConfig().runsDir,
        reports: [],
        status: 'no_reports',
      }
    }
    const input = buildResolveTaskResultInput(taskResultInputSourceFromSession(this), taskId)
    if (!input) {
      return {
        taskId,
        runsDirRel: this.requireConfig().runsDir,
        reports: [],
        status: 'error',
        errorCode: 'read_failed',
      }
    }
    return resolveTaskResultBundle(input)
  }

  async toggleHookServer(input: {
    enabled: boolean
    port?: number
  }): Promise<{ state: IntegrationsState; bearerSecret?: string }> {
    const paths = this.requireSidecarPaths()
    const config = this.requireConfig()
    try {
      const result = await this.integrationsService.toggleHookServer(paths, config, input)
      this.config = result.config
      await this.refreshState()
      return { state: result.state, bearerSecret: result.bearerSecret }
    } catch (error) {
      if (error instanceof HookServerStartError) {
        this.config = error.configAfterRollback
        await this.refreshState()
      }
      throw error
    }
  }

  async toggleAdapter(id: IntegrationAdapterId, enabled: boolean): Promise<IntegrationsState> {
    const paths = this.requireSidecarPaths()
    const config = this.requireConfig()
    const result = await this.integrationsService.toggleAdapter(paths, config, id, enabled)
    this.config = result.config
    await this.refreshState()
    return result.state
  }

  pushExternalAgent(id: IntegrationAdapterId): void {
    this.integrationsService.pushExternalAgent(id)
    void this.refreshAndNotify()
  }

  async listExecutionLog(query?: ExecutionLogQuery): Promise<ExecutionLogListResult> {
    const state = this.getState()
    if (!state) throw new Error('No workspace open')
    const runEvents = this.loadRunEventsForAnalytics()
    return listExecutionLog({
      runEvents,
      tasks: state.tasks,
      executors: state.executors,
      query,
    })
  }

  async getExecutionSummary(input?: ExecutionSummaryGetInput): Promise<ExecutionSummary> {
    const state = this.getState()
    if (!state) throw new Error('No workspace open')
    return computeExecutionSummary({
      tasks: state.tasks,
      executors: state.executors,
      window: input?.window,
    })
  }

  async fetchGitHubIssue(input: GitHubIssueFetchInput): Promise<GitHubIssueView> {
    return this.githubIssueService.fetch(input, { workspacePath: this.workspacePath })
  }

  async listOpenGitHubIssues(
    input: GitHubIssueListOpenInput = {},
  ): Promise<GitHubIssueListOpenResult> {
    return this.githubIssueService.listOpen(input, { workspacePath: this.workspacePath })
  }

  async listPendingIntentLedger(input?: IntentLedgerListPendingInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const entries = await this.intentLedgerStore.listPending(paths, input ?? undefined)
    return { entries }
  }

  async countPendingIntentLedger(input?: IntentLedgerListPendingInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const count = await this.intentLedgerStore.countPending(paths, input ?? undefined)
    return { count }
  }

  async getIntentLedgerSummary(input?: IntentLedgerGetSummaryInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    return this.intentLedgerStore.aggregateSummary(paths, input ?? undefined)
  }

  /** Intent ledger entries across every task spawned from a conversation thread. */
  async listIntentLedgerByThread(input: IntentLedgerListByThreadInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const taskIds = await this.taskThreadLinkStore.listTaskIds(paths, input.threadId)
    const entries: IntentLedgerRecord[] = []
    for (const taskId of taskIds) {
      entries.push(...(await this.intentLedgerStore.listByTaskId(paths, taskId)))
    }
    const snapshots = await this.taskSupplySnapshotStore.listByTaskIds(paths, taskIds)
    const snapshotByTaskId = new Map(snapshots.map((row) => [row.taskId, row]))
    const snapshotEntryIds = [...new Set(snapshots.flatMap((row) => row.entryIds))]
    const snapshotRecords = await this.intentLedgerStore.listByIds(paths, snapshotEntryIds)
    const snapshotEntryById = new Map(
      snapshotRecords.map((record) => [record.id, intentLedgerRecordToEntry(record)]),
    )
    const trace: TaskSupplyTraceItem[] = taskIds.map((taskId) => {
      const row = snapshotByTaskId.get(taskId)
      if (!row) {
        return { taskId, snapshot: null }
      }
      const snapshot = {
        entryIds: row.entryIds,
        capturedAt: row.capturedAt,
        matchBasis: row.matchBasis,
      }
      const suppliedEntries = row.entryIds
        .map((id) => snapshotEntryById.get(id))
        .filter((entry): entry is IntentLedgerEntry => entry != null)
      return { taskId, snapshot, suppliedEntries }
    })
    return { entries, taskIds, trace }
  }

  /** Established decisions available to be referenced (supply approximation). */
  async listSupplyIntentLedger() {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const entries = await this.intentLedgerStore.listSupply(paths)
    return { entries }
  }

  async getCurrentDecidedIntent(input: DecidedIntentThreadInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const intent = await this.decidedIntentStore.getCurrent(paths, input.threadId)
    return { intent }
  }

  async listDecidedIntentVersions(input: DecidedIntentThreadInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const versions = await this.decidedIntentStore.listVersions(paths, input.threadId)
    return { versions }
  }

  async saveDecidedIntent(input: DecidedIntentSaveInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const intent = await this.decidedIntentStore.save(paths, input)
    return { intent }
  }

  async getIntentDraft(input: IntentDraftThreadInput) {
    const paths = this.requireSidecarPaths()
    const draft = await this.intentDraftStore.load(paths, input.threadId)
    return { draft }
  }

  async saveIntentDraft(input: IntentDraftSaveInput) {
    const paths = this.requireSidecarPaths()
    const draft = await this.intentDraftStore.save(paths, input)
    return { draft }
  }

  async generateIntentDraft(input: IntentDraftGenerateInput) {
    const paths = this.requireSidecarPaths()
    const workspacePath = this.requireWorkspacePath()
    const currentIntent = await this.decidedIntentStore.getCurrent(paths, input.threadId)
    const existingDraft = await this.intentDraftStore.load(paths, input.threadId)
    const autoGenerateDefault = currentIntent === null
    const autoGenerate = existingDraft?.autoGenerate ?? autoGenerateDefault
    const touchedByUser = existingDraft?.touchedByUser ?? false
    if (!autoGenerate || touchedByUser) {
      return { draft: existingDraft }
    }

    const threadWithTurns = await this.conversationLedgerStore.getWithTurns(
      paths,
      workspacePath,
      input.threadId,
    )
    if (!threadWithTurns) {
      return { draft: existingDraft }
    }

    const engineConfig = await this.loadEffectiveEngineConfig()
    const profile = resolveExecutionProfile(engineConfig)
    if (!profile.provider) {
      return { draft: existingDraft }
    }

    try {
      const generated = await generateIntentDraftFromConversation({
        threadId: input.threadId,
        turns: threadWithTurns.turns,
        currentIntent,
        existingDraft,
        provider: profile.provider,
        model: profile.model,
        cwd: this.requireTaktRepoPath(),
        engineConfig,
        sourceTurnId: input.sourceTurnId,
      })
      if (!generated) return { draft: existingDraft }
      const draft = await this.intentDraftStore.save(paths, generated)
      return { draft }
    } catch (error) {
      console.warn('[planetz] intent draft generation failed', error)
      return { draft: existingDraft }
    }
  }

  async clearIntentDraft(input: IntentDraftThreadInput) {
    const paths = this.requireSidecarPaths()
    await this.intentDraftStore.clear(paths, input.threadId)
    return { ok: true as const }
  }

  /** Aggregates open conversation threads into Spec Thread summaries for Spec Studio. */
  async listSpecThreadSummaries(input?: SpecThreadSummaryListInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const workspacePath = this.requireWorkspacePath()
    const threads = await this.conversationLedgerStore.listOpen(paths, workspacePath, input?.limit)
    const summaries: SpecThreadSummary[] = []
    for (const thread of threads) {
      const taskIds = await this.taskThreadLinkStore.listTaskIds(paths, thread.threadId)
      const facts: SpecThreadLedgerFact[] = []
      for (const taskId of taskIds) {
        const records = await this.intentLedgerStore.listByTaskId(paths, taskId)
        for (const record of records) {
          facts.push({
            authority: record.authority,
            ratifiedAt: record.ratifiedAt,
            observedUnanchored: record.observedUnanchored ?? null,
          })
        }
      }
      const decided = await this.decidedIntentStore.getCurrent(paths, thread.threadId)
      const counts = computeSpecThreadCounts(facts)
      summaries.push({
        threadId: thread.threadId,
        title: thread.title,
        phase: resolveSpecThreadPhase({
          hasDecidedIntent: decided !== null,
          taskCount: taskIds.length,
          driftCount: counts.driftCount,
        }),
        adrCount: counts.adrCount,
        pendingCount: counts.pendingCount,
        driftCount: counts.driftCount,
        taskCount: taskIds.length,
        hasDecidedIntent: decided !== null,
        updatedAt: thread.updatedAt,
      })
    }
    return { summaries }
  }

  async ratifyIntentLedgerEntry(entryId: string) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const ok = await this.intentLedgerStore.ratify(paths, entryId)
    if (!ok) throw new Error(`Intent ledger entry not found or not ratifiable: ${entryId}`)
    this.invalidateSddOpenSnapshot()
    return { ok: true as const }
  }

  async reverseIntentLedgerEntry(entryId: string) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const ok = await this.intentLedgerStore.reverse(paths, entryId)
    if (!ok) throw new Error(`Intent ledger entry not found or not reversible: ${entryId}`)
    this.invalidateSddOpenSnapshot()
    return { ok: true as const }
  }

  async adoptIntentLedgerEntry(input: IntentLedgerAdoptInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')

    const entry = await this.intentLedgerStore.getById(paths, input.entryId)
    if (!entry) throw new Error(`Intent ledger entry not found: ${input.entryId}`)

    const ok = await this.intentLedgerStore.adopt(paths, {
      entryId: input.entryId,
      reason: input.reason,
    })
    if (!ok) throw new Error(`Intent ledger entry not found or not adoptable: ${input.entryId}`)

    let promotedReqId: string | undefined
    let promotedReqIdUnlinked = false
    const resolveInput = buildResolveTaskResultInput(
      taskResultInputSourceFromSession(this),
      entry.taskId,
    )
    if (resolveInput) {
      try {
        const promotion = await this.requirementsPromotionService.promoteAdoptedEntry({
          paths,
          entryId: input.entryId,
          resolveTaskResult: resolveInput,
        })
        if (promotion.status === 'promoted') {
          promotedReqId = promotion.reqId
          await this.linkPromotedRequirementToCurrentIntent(paths, entry.taskId, promotedReqId)
          const linked = await this.intentLedgerStore.setPromotedReqId(
            paths,
            input.entryId,
            promotedReqId,
          )
          if (!linked) {
            promotedReqIdUnlinked = true
            console.warn(
              '[planetz] adopt promoted requirements but failed to link promoted_req_id',
              input.entryId,
              promotedReqId,
            )
          }
        }
      } catch (error) {
        console.warn('[planetz] requirements promotion after adopt failed', error)
      }
    }

    this.invalidateSddOpenSnapshot()

    return {
      ok: true as const,
      ...(promotedReqId ? { promotedReqId } : {}),
      ...(promotedReqIdUnlinked ? { promotedReqIdUnlinked: true as const } : {}),
    }
  }

  private async linkPromotedRequirementToCurrentIntent(
    paths: SidecarPaths,
    taskId: string,
    reqId: string,
  ): Promise<void> {
    const threadId = await this.taskThreadLinkStore.getThreadId(paths, taskId)
    if (!threadId) return

    const intent = await this.decidedIntentStore.getCurrent(paths, threadId)
    if (!intent) return

    const rationaleParts = [`Promoted under decided intent v${intent.version}: ${intent.what}`]
    if (intent.why.trim().length > 0) {
      rationaleParts.push(`Why: ${intent.why}`)
    }

    await this.requirementIntentLinkStore.upsert(paths, {
      reqId,
      threadId,
      decidedIntentVersion: intent.version,
      rationale: rationaleParts.join(' '),
      sourceTaskId: taskId,
    })
  }

  async fixIntentLedgerEntry(input: IntentLedgerFixInput) {
    const paths = this.sidecarPaths
    if (!paths) throw new Error('No workspace open')
    const ok = await this.intentLedgerStore.fix(paths, {
      entryId: input.entryId,
      reason: input.reason,
    })
    if (!ok) throw new Error(`Intent ledger entry not found or not fixable: ${input.entryId}`)
    this.invalidateSddOpenSnapshot()
    return { ok: true as const }
  }

  async listKiroSpecs() {
    const workspacePath = this.workspacePath
    if (!workspacePath) throw new Error('No workspace open')
    const specs = await this.kiroSpecStore.listSpecs(workspacePath)
    return { specs }
  }

  async getKiroSpec(input: KiroSpecGetInput) {
    const workspacePath = this.workspacePath
    if (!workspacePath) throw new Error('No workspace open')
    const spec = await this.kiroSpecStore.getSpec(workspacePath, input.featureId)
    return { spec }
  }

  async regenerateEstablishedDecisionsForTask(
    input: Pick<EnqueueTaskInput, 'title' | 'body'>,
  ): Promise<string[]> {
    const paths = this.sidecarPaths
    const workspacePath = this.workspacePath
    const config = this.config
    if (!paths || !workspacePath || !config) return []
    return this.establishedDecisionsWriter.regenerateForTask(workspacePath, config, paths, input)
  }

  async regenerateDecidedIntentContextForTask(taskId: string): Promise<boolean> {
    const paths = this.sidecarPaths
    const workspacePath = this.workspacePath
    const config = this.config
    if (!paths || !workspacePath || !config) return false
    return this.decidedIntentContextWriter.regenerateForTask(workspacePath, config, paths, taskId)
  }

  async getValidationCoverageSummary() {
    const paths = this.sidecarPaths
    const workspacePath = this.workspacePath
    if (!paths || !workspacePath) throw new Error('No workspace open')
    return this.validationCoverageService.summarize(paths, workspacePath)
  }

  async upsertTaskSupplySnapshot(taskId: string, entryIds: readonly string[]): Promise<void> {
    const paths = this.sidecarPaths
    if (!paths) return
    await this.taskSupplySnapshotStore.upsert(paths, taskId, entryIds)
  }

  setCachedRunEvents(runEvents: RunEvent[]): void {
    this.cachedRunEvents = runEvents
  }

  private loadRunEventsForAnalytics(): RunEvent[] {
    return this.cachedRunEvents
  }

  listPromptHistory(limit?: number) {
    return this.taskCommands.listPromptHistory(limit)
  }

  deletePromptHistoryItem(id: string) {
    return this.taskCommands.deletePromptHistoryItem(id)
  }

  listConversationHistory(input?: ConversationHistoryListInput) {
    return this.conversationHistoryService.list(input)
  }

  getConversationHistory(input: ConversationHistoryGetInput) {
    return this.conversationHistoryService.get(input)
  }

  deleteConversationHistory(input: ConversationHistoryDeleteInput) {
    return this.conversationHistoryService.delete(input)
  }

  searchConversationHistory(input: ConversationHistorySearchInput) {
    return this.conversationHistoryService.search(input)
  }

  async getChatComposerDraft() {
    const paths = this.requireSidecarPaths()
    const snapshot = await this.chatComposerDraftStore.load(paths)
    return { snapshot }
  }

  async saveChatComposerDraft(input: ChatComposerDraftSaveInput) {
    const paths = this.requireSidecarPaths()
    await this.chatComposerDraftStore.save(paths, input)
    return { ok: true as const }
  }

  async recordChatToTaskMetric(input: ChatToTaskMetricRecordInput): Promise<void> {
    try {
      if (!this.workspacePath || !this.sidecarPaths) return
      await this.chatToTaskMetricsStore.record(this.sidecarPaths, input.event)
    } catch {
      // Metrics must not block handoff flows.
    }
  }

  startComposerSession(input: ComposerSessionStartInput): Promise<ComposerAssistantTurn> {
    return this.composerAssistantService.start(input)
  }

  getActiveComposerSession(): Promise<ComposerAssistActiveSession | null> {
    return this.composerAssistantService.getActive()
  }

  getComposerAssistCapabilities() {
    return Promise.resolve({
      startMode: resolveComposerAssistStartMode(),
      headlessRunnerReady: isHeadlessInteractiveRunnerReady(),
    })
  }

  resumeComposerSession(
    input: ComposerSessionResumeInput = {},
  ): Promise<ComposerAssistActiveSession> {
    return this.composerAssistantService.resume(input)
  }

  messageComposerSession(input: ComposerSessionMessageInput): Promise<ComposerAssistantTurn> {
    return this.composerAssistantService.message(input)
  }

  finalizeComposerSession(
    input: ComposerSessionFinalizeInput,
  ): Promise<ComposerAssistantFinalizeResult> {
    return this.composerAssistantService.finalize(input)
  }

  acceptComposerSession(
    input: ComposerSessionAcceptInput,
  ): Promise<ComposerAssistantFinalizeResult> {
    return this.composerAssistantService.accept(input)
  }

  playComposerSession(input: ComposerSessionPlayInput): Promise<ComposerAssistantFinalizeResult> {
    return this.composerAssistantService.play(input)
  }

  buildComposerSourceContext(input: ComposerSourceContextBuildInput) {
    return buildComposerSourceContext(
      {
        githubIssueService: this.githubIssueService,
        workspacePath: this.workspacePath,
      },
      input,
    )
  }

  cancelComposerSession(input: ComposerSessionCancelInput): Promise<void> {
    return this.composerAssistantService.cancel(input)
  }

  interruptComposerSession(input: ComposerSessionInterruptInput): Promise<void> {
    return this.composerAssistantService.interrupt(input)
  }

  requireSidecarPaths(): SidecarPaths {
    if (!this.workspacePath || !this.sidecarPaths) {
      throw new Error('No workspace open')
    }
    return this.sidecarPaths
  }

  requireWorkspacePath(): string {
    if (!this.workspacePath) throw new Error('No workspace open')
    return this.workspacePath
  }

  requireTaktRepoPath(): string {
    return this.taktExecutionPath ?? this.requireWorkspacePath()
  }

  requireConfig(): UiConfig {
    if (!this.config) throw new Error('No workspace open')
    return this.config
  }

  readTaktTasksFresh(): Promise<TaskViewModel[]> {
    return this.taskCatalog.readFresh(this.requireTaktRepoPath(), this.requireConfig())
  }

  readTaktTasksFreshAt(taktRepoPath: string): Promise<TaskViewModel[]> {
    return this.taskCatalog.readFresh(taktRepoPath, this.requireConfig())
  }

  invalidateTaktTaskYamlCache(): void {
    this.taskCatalog.invalidate()
  }

  async syncWatchConnection(stoppedPid: number): Promise<void> {
    if (!this.watchManager || !this.sidecarPaths) return
    this.connection.watch = await this.watchManager.syncConnectionAfterStop(
      this.sidecarPaths,
      stoppedPid,
    )
  }

  taktTaskIdSet(tasks: TaskViewModel[]): Set<string> {
    return this.taskCatalog.idSet(tasks)
  }

  requireCanonicalWorkflowManager(): PlanetzWorkflowCanonicalManager {
    if (!this.canonicalWorkflowManager) throw new Error('No workspace open')
    return this.canonicalWorkflowManager
  }

  async getEngineConfig(): Promise<{ config: EngineConfig; path: string }> {
    return this.configExecution.getEngineConfig()
  }

  async getAgentOverrides(): Promise<{ overrides: AgentOverrides; path: string }> {
    return this.configExecution.getAgentOverrides()
  }

  async updateAgentOverrides(patch: AgentOverridesUpdateInput): Promise<{
    overrides: AgentOverrides
    path: string
    engineConfig: EngineConfig
    effectiveEngineConfig: EngineConfig
  }> {
    return this.configExecution.updateAgentOverrides(patch)
  }

  async openYaml(input: YamlOpenInput) {
    return openPlanetzYaml(this.requireSidecarPaths(), input)
  }

  openTaskWorkDir(taskId: string) {
    if (this.mockQueueEnabled()) {
      return Promise.resolve({
        status: 'denied' as const,
        message: 'Task work directory is not available in mock queue mode',
      })
    }
    return openTaskWorkDirOnDisk({
      taktRepoPath: this.requireTaktRepoPath(),
      workspacePath: this.workspacePath,
      config: this.requireConfig(),
      taskId,
    })
  }

  openTaskResultPath(input: Pick<TaskResultPathOpenInput, 'taskId' | 'action' | 'relativePath'>) {
    if (this.mockQueueEnabled()) {
      return Promise.resolve({
        status: 'denied' as const,
        message: 'Task result paths are not available in mock queue mode',
      })
    }
    const task = this.cachedState?.tasks.find((t) => t.id === input.taskId)
    const executorId = task?.executorAttribution?.executorId ?? task?.assignedAgentId
    return openTaskResultPathOnDisk({
      taktRepoPath: this.requireTaktRepoPath(),
      workspacePath: this.workspacePath,
      config: this.requireConfig(),
      taskId: input.taskId,
      action: input.action,
      relativePath: input.relativePath,
      assignedAgentId: executorId,
      readWorkflowYaml: async (workflowName) => {
        try {
          const { yaml } = await this.workflowManager.read(workflowName)
          return yaml
        } catch {
          return null
        }
      },
    })
  }

  listExecutionCatalog(): Promise<ExecutionCatalog> {
    return this.configExecution.listExecutionCatalog()
  }

  invalidateExecutionCatalogCache(): void {
    this.configExecution.invalidateExecutionCatalogCache()
  }

  listProviderModels(input: ListProviderModelsInput) {
    return this.configExecution.listProviderModels(input)
  }

  async readWorkflowYaml(workflowName: string): Promise<string | null> {
    try {
      const { yaml } = await this.workflowManager.read(workflowName)
      return yaml
    } catch {
      return null
    }
  }

  async readWorkflowDocument(
    nameOrPath: string,
    source?: 'builtin' | 'project' | 'user' | 'imported',
  ): Promise<{ yaml: string; source: import('@planetz/shared').WorkflowSource }> {
    const mappedSource = source === 'imported' ? ('project' as const) : source
    const doc = await this.workflowManager.read(nameOrPath, mappedSource)
    return { yaml: doc.yaml, source: doc.source }
  }

  getWorkflowPreview(input: import('@planetz/shared').WorkflowGetPreviewInput) {
    return this.taskCommands.getWorkflowPreview(input)
  }

  previewWorkflowAutoRoute(input: import('@planetz/shared').WorkflowPreviewAutoRouteInput) {
    return this.taskCommands.previewWorkflowAutoRoute(input)
  }

  swapTaskWorkflow(input: import('@planetz/shared').TaskSwapWorkflowInput) {
    return this.taskCommands.swapTaskWorkflow(input)
  }

  get localLlmService() {
    return getDefaultLocalLlmService()
  }

  async resolveEngineConfigForOllamaAdmin(preview?: EngineConfig): Promise<EngineConfig> {
    return this.localLlmService.resolveEngineForLocalLlm(preview)
  }

  async getOllamaHealth(input?: OllamaHealthGetInput) {
    return this.localLlmService.getOllamaHealth(input, this.ollamaHealthMonitor)
  }

  previewOllamaExecutionGuard(
    input: OllamaExecutionGuardPreviewInput,
  ): Promise<OllamaExecutionGuardPreviewResult> {
    return this.taskCommands.previewOllamaExecutionGuard(input)
  }

  listModelHistory(provider?: string) {
    return this.configExecution.listModelHistory(provider)
  }

  rememberProviderModelSelection(input: { provider: string; model?: string }) {
    return this.settings.rememberProviderModelSelection(input)
  }

  deleteModelHistoryItem(input: { provider: string; model: string }) {
    return this.configExecution.deleteModelHistoryItem(input)
  }

  listProviderEfforts(input: ListProviderEffortsInput) {
    return this.configExecution.listProviderEfforts(input)
  }

  listEffortHistory(provider?: string) {
    return this.configExecution.listEffortHistory(provider)
  }

  deleteEffortHistoryItem(input: { provider: string; effort: string }) {
    return this.configExecution.deleteEffortHistoryItem(input)
  }

  resolveExecutionProfileForInput(input: EnqueueTaskInput): Promise<ExecutionProfile> {
    return this.configExecution.resolveExecutionProfileForInput(input)
  }

  loadEffectiveEngineConfig(): Promise<EngineConfig> {
    return this.configExecution.loadEffectiveEngineConfig()
  }

  trackTaskExecutionProfile(taskId: string, profile: ExecutionProfile): void {
    this.configExecution.trackTaskExecutionProfile(taskId, profile)
  }

  async recordExecutionSuccess(profile: ExecutionProfile): Promise<void> {
    return this.configExecution.recordExecutionSuccess(profile)
  }

  async onTasksUpdatedForModelHistory(tasks: TaskViewModel[]): Promise<void> {
    return this.configExecution.onTasksUpdatedForModelHistory(tasks)
  }

  resetModelHistoryTracker(): void {
    this.configExecution.resetModelHistoryTracker()
  }

  async updateEngineConfig(patch: EngineConfigUpdateInput): Promise<{
    config: EngineConfig
    path: string
  }> {
    return this.configExecution.updateEngineConfig(patch)
  }

  importEngineConfigFromTakt(options?: {
    overwrite?: boolean
  }): Promise<{ config: EngineConfig; path: string; overwritten: boolean }> {
    return this.configExecution.importEngineConfigFromTakt(options)
  }

  importGlobalTaktFromHome(options?: {
    overwrite?: boolean
  }): Promise<{ configImported: boolean; workflowsImported: string[] }> {
    return this.configExecution.importGlobalTaktFromHome(options)
  }

  writeProjectWorkflow(
    name: string,
    yaml: string,
    facetFiles?: Record<string, string>,
  ): Promise<{ path: string }> {
    return this.workflowImports.writeProjectWorkflow(name, yaml, facetFiles)
  }

  installSpecDrivenWorkflow(): Promise<{ path: string }> {
    return this.workflowImports.installSpecDrivenWorkflow()
  }

  importWorkflowFromTakt(
    name: string,
    options?: { overwrite?: boolean },
  ): Promise<{ path: string; overwritten: boolean }> {
    return this.workflowImports.importWorkflowFromTakt(name, options)
  }

  private async listTasksForChain(): Promise<TaskViewModel[]> {
    if (this.mockQueueEnabled()) return this.mockTasks
    if (!this.workspacePath || !this.config) return []
    return this.readTaktTasksFresh()
  }
}
