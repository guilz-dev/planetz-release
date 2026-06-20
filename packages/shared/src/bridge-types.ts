import type { AgentOverrides } from './agent-overrides-schema.js'
import type {
  ChatSessionApplyChangesInput,
  ChatSessionApplyChangesResult,
  ChatSessionPendingChangeFileInput,
  ChatSessionPendingChangeFileResult,
  ChatSessionPendingChangesResult,
  ChatSessionThreadInput,
} from './chat-session-apply.js'
import type { ChatToTaskMetricRecordInput } from './chat-to-task-metrics.js'
import type {
  DecidedIntent,
  DecidedIntentSaveInput,
  DecidedIntentThreadInput,
} from './decided-intent.js'
import type { EffortHistoryItem, ListProviderEffortsResult } from './effort-candidate-types.js'
import type { EngineConfig } from './engine-config-schema.js'
import type {
  ExecutionLogListResult,
  ExecutionLogQuery,
  ExecutionSummary,
} from './execution-analytics-types.js'
import type { ExecutionCatalog } from './execution-catalog.js'
import type {
  FacetDocument,
  FacetKind,
  FacetUsageSummary,
  ProjectFacetSummary,
} from './facet-types.js'
import type {
  GitHubIssueListOpenInput,
  GitHubIssueListOpenResult,
  GitHubIssueView,
} from './github-issue-types.js'
import type {
  IntentDraft,
  IntentDraftGenerateInput,
  IntentDraftSaveInput,
  IntentDraftThreadInput,
} from './intent-draft.js'
import type { IntentLedgerEntry, IntentLedgerSummary } from './intent-ledger-schema.js'
import type {
  AgentOverridesUpdateInput,
  CanonicalImportConfirmInput,
  ChatComposerDraftGetResult,
  ChatComposerDraftSaveInput,
  ChatComposerDraftSaveResult,
  ComposerAssistCapabilities,
  ComposerSessionStartInput,
  ConversationHistoryDeleteInput,
  ConversationHistoryDeleteResult,
  ConversationHistoryGetInput,
  ConversationHistoryGetResult,
  ConversationHistoryListInput,
  ConversationHistoryListResult,
  ConversationHistorySearchInput,
  ConversationHistorySearchResult,
  CreateResultPrInput,
  DesktopCapabilitiesResult,
  EngineConfigImportInput,
  EngineConfigUpdateInput,
  IntentLedgerAdoptInput,
  IntentLedgerEntryIdInput,
  IntentLedgerFixInput,
  IntentLedgerGetSummaryInput,
  IntentLedgerListByThreadInput,
  IntentLedgerListPendingInput,
  OllamaExecutionGuardPreviewInput,
  ResultCheckBranchInput,
  ResultCheckBranchResult,
  SettingsUpdateInput,
  TaktGlobalImportFromHomeInput,
  TaskOpenWorkDirResult,
  TaskResultPathOpenInput,
  WorkflowImportFromTaktInput,
  YamlOpenInput,
  YamlOpenResult,
} from './ipc-schemas.js'
import type { KiroSpecGetInput, KiroSpecSummary } from './kiro-spec-contract.js'
import type {
  ChatMcpGrantConsentInput,
  ChatMcpPendingConsentResult,
  ChatMcpServersOverviewResult,
  ChatMcpSetSecretInput,
  ChatMcpSetSecretResult,
} from './mcp-server-config.js'
import type { ListProviderModelsResult, ModelHistoryItem } from './model-candidate-types.js'
import type { OllamaExecutionGuardPreviewResult } from './ollama-execution-guard.js'
import type { OrbitInteractiveStreamLine } from './orbit-interactive-stream.js'
import type { UiConfig } from './schemas.js'
import type { SpecThreadSummary, SpecThreadSummaryListInput } from './spec-thread-summary.js'
import type { CreateResultPrResult } from './task-pr-types.js'
import type { TaskResultDiffFile, TaskResultDiffSummary } from './task-result-diff.js'
import type { TaskSupplyTraceItem } from './task-supply-snapshot.js'
import type {
  AppState,
  ChainEdgeStatus,
  ComposerAssistActiveSession,
  ComposerAssistantFinalizeResult,
  ComposerAssistantTurn,
  ConversationEntry,
  EnqueueTaskResult,
  IntegrationAdapterId,
  IntegrationsState,
  PromptHistoryItem,
  RecentWorkspace,
  TaskResultBundle,
  WorkflowDiagnostic,
  WorkflowSource,
  WorkflowSummary,
  WorkspaceBootstrapStatus,
} from './types.js'
import type { ValidationCoverageSummary } from './validation-coverage.js'
import type {
  TaskSwapWorkflowInput,
  TaskSwapWorkflowResult,
  WorkflowAutoRoutePreviewResult,
  WorkflowGetPreviewInput,
  WorkflowPreviewAutoRouteInput,
  WorkflowPreviewResult,
  WorkflowRunOverride,
} from './workflow-selection-schema.js'

/** Renderer-safe bridge contract (§14 subset for v0.1 + v0.2 mock surface). */
export interface OrbitBridge {
  onStateUpdate(cb: (state: AppState) => void): () => void
  onComposerSessionStream(cb: (line: OrbitInteractiveStreamLine) => void): () => void
  onUiFocusTask(cb: (taskId: string) => void): () => void
  selectWorkspace(): Promise<
    { canceled: true } | { canceled: false; path: string; state: AppState }
  >
  getWorkspace(): Promise<{ path: string | null; state: AppState | null }>
  /** Current git branch for the open workspace, when resolvable. */
  getWorkspaceCurrentGitBranch(): Promise<{ branch: string | null }>
  /** All local git branches for the open workspace (with current branch when resolvable). */
  listWorkspaceGitBranches(): Promise<{ branches: string[]; currentBranch: string | null }>
  listRecentWorkspaces(): Promise<RecentWorkspace[]>
  openRecentWorkspace(input: { path: string }): Promise<{ path: string; state: AppState }>
  removeRecentWorkspace(input: { path: string }): Promise<RecentWorkspace[]>
  setBootstrapStatus(status: WorkspaceBootstrapStatus): Promise<AppState>
  getDesktopCapabilities(): Promise<DesktopCapabilitiesResult>

  enqueueTask(input: {
    workspaceId?: string
    title?: string
    body?: string
    issueRef?: string
    issueNumber?: number
    workflow?: string
    workflowMode?: 'manual' | 'auto'
    recentWorkflowNames?: string[]
    routingPreviewToken?: string
    routingPromptHash?: string
    confirmedWorkflow?: string
    runOverride?: WorkflowRunOverride
    workflowSelectionKind?: 'auto' | 'modified' | 'manual'
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    assignedAgentId?: string
    provider?: string
    model?: string
  }): Promise<EnqueueTaskResult>
  retryTask(input: { taskId: string }): Promise<{ taskId: string }>
  resumeTask(input: { taskId: string; prompt: string }): Promise<{ taskId: string }>
  stopTask(input: { taskId: string }): Promise<void>
  resumeStoppedTask(input: { taskId: string }): Promise<void>
  reviseTask(input: { taskId: string; prompt: string }): Promise<{ taskId: string }>
  deleteTask(input: { taskId: string }): Promise<void>
  runTaskNow(input: {
    title?: string
    body?: string
    issueRef?: string
    issueNumber?: number
    workflow?: string
    workflowMode?: 'manual' | 'auto'
    recentWorkflowNames?: string[]
    routingPreviewToken?: string
    routingPromptHash?: string
    confirmedWorkflow?: string
    runOverride?: WorkflowRunOverride
    workflowSelectionKind?: 'auto' | 'modified' | 'manual'
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    assignedAgentId?: string
    provider?: string
    model?: string
  }): Promise<EnqueueTaskResult>
  /** Execute an already-enqueued pending task without creating a new tasks.yaml row. */
  runPendingTask(input: { taskId: string }): Promise<void>
  openTaskWorkDir(input: { taskId: string }): Promise<TaskOpenWorkDirResult>
  openTaskResultPath(
    input: Pick<TaskResultPathOpenInput, 'taskId' | 'action' | 'relativePath'>,
  ): Promise<TaskOpenWorkDirResult>

  listConversationsForTask(input: { taskId: string }): Promise<ConversationEntry[]>
  listConversationHistory(
    input?: ConversationHistoryListInput,
  ): Promise<ConversationHistoryListResult>
  getConversationHistory(input: ConversationHistoryGetInput): Promise<ConversationHistoryGetResult>
  deleteConversationHistory(
    input: ConversationHistoryDeleteInput,
  ): Promise<ConversationHistoryDeleteResult>
  searchConversationHistory(
    input: ConversationHistorySearchInput,
  ): Promise<ConversationHistorySearchResult>
  getChatComposerDraft(): Promise<ChatComposerDraftGetResult>
  saveChatComposerDraft(input: ChatComposerDraftSaveInput): Promise<ChatComposerDraftSaveResult>
  getChatSessionPendingChanges(
    input: ChatSessionThreadInput,
  ): Promise<ChatSessionPendingChangesResult>
  getChatSessionPendingChangeFile(
    input: ChatSessionPendingChangeFileInput,
  ): Promise<ChatSessionPendingChangeFileResult>
  applyChatSessionChanges(
    input: ChatSessionApplyChangesInput,
  ): Promise<ChatSessionApplyChangesResult>
  listChatMcpPendingConsent(): Promise<ChatMcpPendingConsentResult>
  grantChatMcpConsent(input: ChatMcpGrantConsentInput): Promise<void>
  listChatMcpServersOverview(): Promise<ChatMcpServersOverviewResult>
  setChatMcpSecret(input: ChatMcpSetSecretInput): Promise<ChatMcpSetSecretResult>
  recordChatToTaskMetric(input: ChatToTaskMetricRecordInput): Promise<void>
  getTaskResult(input: { taskId: string }): Promise<TaskResultBundle>
  listTaskResultDiff(input: { taskId: string; branch: string }): Promise<TaskResultDiffSummary>
  getTaskResultDiffFile(input: {
    taskId: string
    branch: string
    path: string
  }): Promise<TaskResultDiffFile>
  mergeResult(input: { taskId: string; branch: string }): Promise<string>
  createResultPr(input: CreateResultPrInput): Promise<CreateResultPrResult>
  checkResultBranch(input: ResultCheckBranchInput): Promise<ResultCheckBranchResult>
  initializeWorkspace(input: { createTaktDir: boolean }): Promise<AppState>
  startWatch(): Promise<AppState['connection']>
  stopWatch(): Promise<AppState['connection']>

  listPromptHistory(input?: { limit?: number }): Promise<PromptHistoryItem[]>
  deletePromptHistoryItem(input: { id: string }): Promise<void>

  startComposerSession(input: ComposerSessionStartInput): Promise<ComposerAssistantTurn>
  getActiveComposerSession(): Promise<ComposerAssistActiveSession | null>
  getComposerAssistCapabilities(): Promise<ComposerAssistCapabilities>
  resumeComposerSession(input?: { sessionId?: string }): Promise<ComposerAssistActiveSession>
  messageComposerSession(input: {
    sessionId: string
    message: string
    attachments?: import('./conversation-artifact-types.js').ArtifactRef[] | undefined
  }): Promise<ComposerAssistantTurn>
  finalizeComposerSession(input: { sessionId: string }): Promise<ComposerAssistantFinalizeResult>
  acceptComposerSession(input: { sessionId: string }): Promise<ComposerAssistantFinalizeResult>
  playComposerSession(input: {
    sessionId: string
    task: string
  }): Promise<ComposerAssistantFinalizeResult>
  buildComposerSourceContext(
    input:
      | { kind: 'issue'; ref: string }
      | {
          kind: 'pr'
          repository: { owner: string; name: string }
          number: number
          title: string
          url: string
          body?: string
        },
  ): Promise<{ sourceContext: string }>
  cancelComposerSession(input: { sessionId: string }): Promise<void>
  interruptComposerSession(input: { sessionId: string }): Promise<void>

  getWorkflowPreview(input: WorkflowGetPreviewInput): Promise<WorkflowPreviewResult>
  previewWorkflowAutoRoute(
    input: WorkflowPreviewAutoRouteInput,
  ): Promise<WorkflowAutoRoutePreviewResult>
  swapTaskWorkflow(input: TaskSwapWorkflowInput): Promise<TaskSwapWorkflowResult>

  listWorkflows(): Promise<WorkflowSummary[]>
  readWorkflow(input: { nameOrPath: string; source?: 'builtin' | 'project' | 'user' }): Promise<{
    source: WorkflowSource
    path?: string
    yaml: string
  }>
  readWorkflowFacets(input: { managedPaths: string[] }): Promise<
    Array<{
      managedPath: string
      source: 'project' | 'user' | 'builtin' | 'missing'
      content: string | null
    }>
  >
  listWorkflowBuiltinFacets(): Promise<{
    personas: string[]
    policies: string[]
    knowledge: string[]
    instructions: string[]
    reportFormats: string[]
  }>
  listProjectFacets(): Promise<ProjectFacetSummary[]>
  readFacet(input: {
    kind: FacetKind
    key: string
    source?: 'project' | 'builtin' | 'user'
  }): Promise<FacetDocument>
  writeProjectFacet(input: {
    kind: FacetKind
    key: string
    content: string
  }): Promise<{ path: string }>
  deleteProjectFacet(input: { kind: FacetKind; key: string }): Promise<void>
  listFacetUsages(input: { kind: FacetKind; key: string }): Promise<FacetUsageSummary>
  writeProjectWorkflow(input: {
    name: string
    yaml: string
    facetFiles?: Record<string, string>
  }): Promise<{ path: string }>
  installSpecDrivenWorkflow(): Promise<{ path: string }>
  validateWorkflow(input: { nameOrPath: string; yaml?: string }): Promise<WorkflowDiagnostic[]>
  pickWorkflowImportYaml(): Promise<
    { canceled: true } | { canceled: false; path: string; yaml: string }
  >
  saveWorkflowDraft(input: { name: string; yaml: string }): Promise<void>
  loadWorkflowDraft(input: { name: string }): Promise<{ yaml: string | null }>
  deleteWorkflowDraft(input: { name: string }): Promise<void>

  /** v0.3: task dependency chain. */
  createChainTask(input: {
    fromTaskId: string
    title: string
    body?: string
    workflow?: string
    mode: 'branch_handoff' | 'merge_then_continue'
    sourceBranch?: string
    baseBranch?: string
    chainId?: string
    deferTaskCreation?: boolean
  }): Promise<{ chainId: string; taskId?: string }>
  materializeChainEdge(input: {
    chainId: string
    fromTaskId: string
  }): Promise<{ taskId: string; chainId: string; warnings?: string[] }>
  checkChainSourceBranch(branch: string): Promise<{ exists: boolean }>
  deleteChain(input: { chainId: string; edgeKey?: string }): Promise<void>
  setChainEdgeStatus(input: {
    chainId: string
    fromTaskId: string
    toTaskId?: string
    status: ChainEdgeStatus
  }): Promise<void>

  /** v0.3: integrations (HookServer + external adapters). */
  toggleHookServer(input: {
    enabled: boolean
    port?: number
  }): Promise<{ state: IntegrationsState; bearerSecret?: string }>
  toggleAdapter(input: { id: IntegrationAdapterId; enabled: boolean }): Promise<IntegrationsState>
  pushExternalAgent(input: { id: IntegrationAdapterId }): Promise<void>

  selectTask(taskId: string): Promise<void>
  getConnectionStatus(): Promise<AppState['connection']>
  getSettings(): Promise<{ workspacePath: string | null; config: UiConfig | null }>
  updateSettings(patch: SettingsUpdateInput): Promise<{
    config: UiConfig
    connection: AppState['connection']
  }>

  getEngineConfig(): Promise<{ config: EngineConfig; path: string }>
  getAgentOverrides(): Promise<{ overrides: AgentOverrides; path: string }>
  updateAgentOverrides(patch: AgentOverridesUpdateInput): Promise<{
    overrides: AgentOverrides
    path: string
    engineConfig: EngineConfig
    effectiveEngineConfig: EngineConfig
  }>
  openYaml(input: YamlOpenInput): Promise<YamlOpenResult>
  listExecutionCatalog(): Promise<ExecutionCatalog>
  listProviderModels(input: {
    provider: string
    currentModel?: string
    workflowName?: string
    refresh?: boolean
    engineConfigPreview?: EngineConfig
  }): Promise<ListProviderModelsResult>
  rememberProviderModelSelection(input: { provider: string; model?: string }): Promise<{ ok: true }>
  listModelHistory(input?: { provider?: string }): Promise<{ items: ModelHistoryItem[] }>
  deleteModelHistoryItem(input: { provider: string; model: string }): Promise<{ ok: true }>
  listProviderEfforts(input: {
    provider: string
    currentEffort?: string
    workflowName?: string
    refresh?: boolean
  }): Promise<ListProviderEffortsResult>
  listEffortHistory(input?: { provider?: string }): Promise<{ items: EffortHistoryItem[] }>
  deleteEffortHistoryItem(input: { provider: string; effort: string }): Promise<{ ok: true }>
  updateEngineConfig(
    patch: EngineConfigUpdateInput,
  ): Promise<{ config: EngineConfig; path: string }>
  importEngineConfigFromTakt(
    input?: EngineConfigImportInput,
  ): Promise<{ config: EngineConfig; path: string; overwritten: boolean }>
  importGlobalTaktFromHome(
    input?: TaktGlobalImportFromHomeInput,
  ): Promise<{ configImported: boolean; workflowsImported: string[] }>
  importWorkflowFromTakt(
    input: WorkflowImportFromTaktInput,
  ): Promise<{ path: string; overwritten: boolean }>
  confirmCanonicalImport(input?: CanonicalImportConfirmInput): Promise<AppState>
  dismissCanonicalImport(): Promise<AppState>

  listExecutionLog(input?: ExecutionLogQuery): Promise<ExecutionLogListResult>
  getExecutionSummary(input?: { window?: '24h' | '7d' | '30d' | 'all' }): Promise<ExecutionSummary>

  getOllamaHealth(input?: { engineConfigPreview?: EngineConfig }): Promise<{
    status: 'healthy' | 'degraded' | 'unreachable'
    lastCheckedAt: string
    latencyMs?: number
    liveErrorCode?: string
    modelCount?: number
  } | null>
  previewOllamaExecutionGuard(
    input: OllamaExecutionGuardPreviewInput,
  ): Promise<OllamaExecutionGuardPreviewResult>
  pullOllamaModel(input: {
    model: string
    engineConfigPreview?: EngineConfig
  }): Promise<{ ok: true }>
  deleteOllamaModel(input: {
    model: string
    engineConfigPreview?: EngineConfig
  }): Promise<{ ok: true }>

  listOpenGitHubIssues(input?: GitHubIssueListOpenInput): Promise<GitHubIssueListOpenResult>
  fetchGitHubIssue(input: { ref: string }): Promise<GitHubIssueView>

  listPendingIntentLedger(
    input?: IntentLedgerListPendingInput,
  ): Promise<{ entries: IntentLedgerEntry[] }>
  countPendingIntentLedger(input?: IntentLedgerListPendingInput): Promise<{ count: number }>
  getIntentLedgerSummary(input?: IntentLedgerGetSummaryInput): Promise<IntentLedgerSummary>
  listIntentLedgerByThread(
    input: IntentLedgerListByThreadInput,
  ): Promise<{ entries: IntentLedgerEntry[]; taskIds: string[]; trace?: TaskSupplyTraceItem[] }>
  listSupplyIntentLedger(): Promise<{ entries: IntentLedgerEntry[] }>
  getCurrentDecidedIntent(
    input: DecidedIntentThreadInput,
  ): Promise<{ intent: DecidedIntent | null }>
  listDecidedIntentVersions(input: DecidedIntentThreadInput): Promise<{ versions: DecidedIntent[] }>
  saveDecidedIntent(input: DecidedIntentSaveInput): Promise<{ intent: DecidedIntent }>
  getIntentDraft(input: IntentDraftThreadInput): Promise<{ draft: IntentDraft | null }>
  saveIntentDraft(input: IntentDraftSaveInput): Promise<{ draft: IntentDraft }>
  generateIntentDraft(input: IntentDraftGenerateInput): Promise<{ draft: IntentDraft | null }>
  clearIntentDraft(input: IntentDraftThreadInput): Promise<{ ok: true }>
  listSpecThreadSummaries(
    input?: SpecThreadSummaryListInput,
  ): Promise<{ summaries: SpecThreadSummary[] }>
  ratifyIntentLedgerEntry(input: IntentLedgerEntryIdInput): Promise<{ ok: true }>
  reverseIntentLedgerEntry(input: IntentLedgerEntryIdInput): Promise<{ ok: true }>
  adoptIntentLedgerEntry(
    input: IntentLedgerAdoptInput,
  ): Promise<{ ok: true; promotedReqId?: string; promotedReqIdUnlinked?: boolean }>
  fixIntentLedgerEntry(input: IntentLedgerFixInput): Promise<{ ok: true }>
  getValidationCoverageSummary(): Promise<ValidationCoverageSummary>
  listKiroSpecs(): Promise<{ specs: KiroSpecSummary[] }>
  getKiroSpec(input: KiroSpecGetInput): Promise<{ spec: KiroSpecSummary }>
}

/** @deprecated Use `OrbitBridge`. */
export type TaktBridge = OrbitBridge
