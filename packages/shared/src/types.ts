import type { ConversationCompactionSummary } from './conversation-artifact-types.js'
import type { SddOpenSnapshot } from './sdd-open-snapshot.js'

export type WorkspaceBootstrapStatus = 'non_takt' | 'partial_takt' | 'takt_ready'

export type TaskStatus = 'pending' | 'running' | 'stopped' | 'completed' | 'failed' | 'exceeded'

/** Failure semantics derived from raw `tasks.yaml` status (orthogonal to canonical `TaskStatus`). */
export type TaskStatusReason =
  | 'task_failed'
  | 'pr_failed'
  | 'iteration_exceeded'
  | 'workflow_aborted'
  | 'interrupted'
  | 'stopped'
  | 'unknown_status'

export type TaskErrorKind =
  | 'pr_creation'
  | 'agent_error'
  | 'rate_limited'
  | 'blocked'
  | 'runtime_error'
  | 'unknown'

export type AgentStatus = 'idle' | 'working' | 'reviewing' | 'waiting' | 'error'

export interface AgentState {
  id: string
  displayName: string
  runtime: 'takt' | 'external'
  role: 'planner' | 'coder' | 'reviewer' | 'tester' | 'custom'
  status: AgentStatus
  currentTaskId?: string
  currentRunId?: string
  workspace?: string
  branch?: string
  logTail: LogEntry[]
  updatedAt: string
}

/** Offered one-shot import from project compat into `.planetz/orbit` (user must confirm in UI). */
export interface CanonicalImportOffer {
  engineConfig: boolean
  workflows: string[]
  /** When true, preview detected importable content under `~/.takt` (marker not set). */
  homeGlobalAvailable?: boolean
  /** Set on confirm when the user opts in to copy `~/.takt` into `.planetz/orbit/import-snapshot/`. */
  importHomeGlobal?: boolean
}

export interface WorkspaceState {
  id: string
  name: string
  path: string
  sidecarPath: string
  isWritable: boolean
  bootstrap: WorkspaceBootstrapStatus
  /** Absolute path to the isolated git repo where Planetz runs bundled takt (never under `path`). */
  taktExecutionPath?: string
}

export interface RecentWorkspace {
  path: string
  lastOpenedAt: string
}

export interface ConnectionState {
  cli: 'unknown' | 'ok' | 'ng'
  watch: 'unknown' | 'running' | 'stopped'
  lastError?: string
  checkedAt?: string
}

export interface LogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface ResultSummaryPullRequest {
  number: number
  url: string
  state: 'open' | 'closed' | 'merged'
  isDraft: boolean
}

export interface ResultSummary {
  taskId: string
  title: string
  status: 'completed' | 'failed' | 'exceeded'
  branch?: string
  completedAt?: string
  pullRequest?: ResultSummaryPullRequest
}

export type {
  TaskReportArtifact,
  TaskResultBundle,
  TaskResultErrorCode,
  TaskResultStatus,
} from './task-result-types.js'

export interface TaskFailureLogEntry {
  at: string
  level: 'warn' | 'error'
  message: string
}

export interface TaskFailure {
  /** ISO-8601. workflow_abort.at when present, else last error/warn log at, else last event at. */
  failedAt: string
  /** Last step_start without a matching step_complete; absent when only logs exist. */
  failedStep?: string
  /** workflow_abort.message; absent when failure was inferred from logs. */
  message?: string
  /** Run that captured the failure (used to deep-link the log view). */
  runId?: string
  /** Most recent warn/error log entries (chronological), capped by projector. */
  recentErrorLog?: TaskFailureLogEntry[]
  kind: 'failed' | 'exceeded'
}

export type WorkflowErrorCode =
  | 'yaml_parse_error'
  | 'doctor_validation_error'
  | 'missing_referenced_file'
  | 'permission_denied'
  | 'name_conflict'
  | 'override_ambiguous'
  | 'builtin_copy_failure'
  | 'cli_failed'
  | 'workspace_not_initialized'

export interface WorkflowDiagnostic {
  level: 'info' | 'warn' | 'error'
  message: string
  path?: string
  code?: WorkflowErrorCode
}

export interface WorkflowOperationError {
  code: WorkflowErrorCode
  message: string
  path?: string
  diagnostics?: WorkflowDiagnostic[]
}

export type WorkflowSource = 'project' | 'user' | 'builtin' | 'path'

export interface WorkflowStepSummary {
  name: string
  persona?: string
}

export type TaskExecutionAttributionSource =
  | 'explicit-assignment'
  | 'workflow-step'
  | 'profile-provider'
  | 'unknown'

export type TaskExecutionAttributionConfidence = 'high' | 'medium' | 'low' | 'none'

/** How the active-step persona string was resolved for attribution (not executor routing). */
export type PersonaAttributionSource = 'runtime-event' | 'workflow-yaml'

export interface TaskExecutionAttribution {
  taskId: string
  runId?: string
  activeStep?: string
  persona?: string
  /** Set when `persona` was resolved for a running task. */
  personaSource?: PersonaAttributionSource
  executorId?: string
  source: TaskExecutionAttributionSource
  confidence: TaskExecutionAttributionConfidence
}

export interface ExecutorState {
  id: string
  displayName: string
  runtime: 'takt' | 'external'
  status: AgentStatus
  activeTaskIds: string[]
  activeRunIds?: string[]
  updatedAt: string
}

export type WorkflowFormMode = 'full' | 'partial' | 'yaml-only'

export interface WorkflowSummary {
  name: string
  source: WorkflowSource
  path?: string
  description?: string
  stepNames: string[]
  agentRoles: string[]
  /** Step names with optional persona per step (canonical for attribution). */
  steps: WorkflowStepSummary[]
  isOverridden: boolean
  diagnostics: WorkflowDiagnostic[]
  /** False when advanced step types or unsupported keys require YAML-only editing. */
  formEditable?: boolean
  /** Form editor capability: full (all steps), partial (advanced steps in YAML), yaml-only. */
  formMode?: WorkflowFormMode
  /** Builtin category labels from workflow-categories.yaml (builtin only). */
  categories?: string[]
}

/** Projected workflow decision metadata for queue UI. */
export interface TaskWorkflowSelectionView {
  kind: 'auto' | 'modified' | 'manual'
  baseWorkflow: string
  displayLabel?: string
}

export interface TaskViewModel {
  id: string
  title: string
  body?: string
  /** Canonical issue ref (`owner/repo#123`) for issue-originated tasks. */
  issueRef?: string
  /** Stable issue link for Issue-tab-originated tasks; avoids title-based correlation. */
  issueNumber?: number
  orderId?: string
  workflow?: string
  /** Persisted workflow decision metadata for queue badges (auto / modified / manual). */
  workflowSelection?: TaskWorkflowSelectionView
  chainId?: string
  dependsOnTaskId?: string
  sourceBranch?: string
  /** Absolute task worktree or package dir; enables open-in-Finder (main re-validates on open). */
  workDirPath?: string
  baseBranch?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: TaskStatus
  assignedAgentId?: string
  source: 'user' | 'takt' | 'external'
  createdAt: string
  updatedAt: string
  activeRunId?: string
  /** Projected by StateProjector from RunEvent; not stored in tasks.yaml. */
  activeStep?: string
  /** Projected executor attribution for running tasks. */
  executorAttribution?: TaskExecutionAttribution
  /** Present only when status is 'failed' or 'exceeded'; built by StateProjector. */
  failure?: TaskFailure
  /** Original `tasks.yaml` status before canonical normalization. */
  rawStatus?: string
  /** Why the task landed in a terminal error lane (e.g. PR creation vs iteration cap). */
  statusReason?: TaskStatusReason
  /** Machine-readable failure sub-kind for UI actions and filters. */
  errorKind?: TaskErrorKind
  /** Per workflow-step activity from run logs (running tasks only). */
  workflowStepActivities?: WorkflowStepActivityView[]
  /** Task-level execution summary (running tasks only; projected, not persisted). */
  executionStatus?: TaskExecutionStatus
  /** Task-level live activity feed (running tasks only; projected, not persisted). */
  liveActivity?: TaskExecutionActivityEntry[]
}

export type TaskExecutionActivityKind =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_output'
  | 'tool_result'
  | 'phase'
  | 'step'
  | 'error'
  | 'status'

export interface TaskExecutionActivityEntry {
  at: string
  kind: TaskExecutionActivityKind
  text: string
  level?: 'info' | 'warn' | 'error'
  stepName?: string
  phaseName?: string
  toolName?: string
  runId?: string
}

export interface TaskExecutionStatus {
  runId?: string
  workflowStep?: string
  innerStep?: string
  phase?: string
  lastEventAt?: string
  lastEventSummary?: string
}

export type StepActivityKind =
  | 'log'
  | 'read'
  | 'edit'
  | 'tool'
  | 'message'
  | 'thinking'
  | 'tool_use'
  | 'tool_output'
  | 'tool_result'
  | 'phase'
  | 'step'
  | 'error'
  | 'status'

export interface StepActivityEntry {
  at: string
  kind: StepActivityKind
  text: string
  level?: 'info' | 'warn' | 'error'
}

export interface WorkflowStepActivityView {
  stepName: string
  latest?: StepActivityEntry
  history: StepActivityEntry[]
  /** Optional fallback summary string for static/mock previews. */
  summary?: string
  /** When present, the step completed and the renderer may localize a completed label. */
  completedAt?: string
  /** Optional elapsed duration for localized completed-step summary rendering. */
  durationSec?: number
}

export type ChainEdgeStatus =
  | 'waiting_for_dependency'
  | 'ready_to_create'
  | 'created'
  | 'blocked'
  | 'invalid'

/** Pending dependent task metadata (§13 — stored until materialize). */
export interface ChainPlannedTask {
  title: string
  body?: string
  workflow?: string
  mode: 'branch_handoff' | 'merge_then_continue'
  sourceBranch?: string
  baseBranch?: string
}

export interface ChainEdge {
  fromTaskId: string
  /** Set after materialize; omitted while only `planned` is stored. */
  toTaskId?: string
  planned?: ChainPlannedTask
  /** Set after materialize; while pending use `planned.mode` via `resolveChainEdgeMode`. */
  mode?: 'branch_handoff' | 'merge_then_continue'
  status: ChainEdgeStatus
  sourceBranch?: string
  baseBranch?: string
}

export interface ChainMaterializeResult {
  taskId: string
  chainId: string
  warnings?: string[]
}

/** §9 chains.json structure. */
export interface ChainGroup {
  id: string
  createdAt: string
  taskIds: string[]
  edges: ChainEdge[]
}

export type IntegrationAdapterId = 'cursor' | 'codex' | 'claude'

export interface IntegrationAdapterState {
  id: IntegrationAdapterId
  displayName: string
  enabled: boolean
  description: string
}

/** §15.2 HookServer settings (v0.3+ optional). */
export interface HookServerState {
  enabled: boolean
  bind: string
  port: number
  /** UI does not persist the secret; this is only the masked indicator. */
  hasSecret: boolean
}

export interface IntegrationsState {
  hookServer: HookServerState
  adapters: IntegrationAdapterState[]
}

export interface RunEvent {
  runId: string
  runDirSlug: string
  sessionId: string
  taskId?: string
  type: 'step_start' | 'step_complete' | 'workflow_complete' | 'workflow_abort' | 'log'
  at: string
  message?: string
  /** Workflow step name when the source event carries it (e.g. provider-events JSONL). */
  step?: string
  /** Persona display name when the source event carries it (Orbit step_start; preferred for attribution). */
  persona?: string
  /** Long-form agent output (step_complete / phase_complete in session JSONL). */
  content?: string
  level?: 'info' | 'warn' | 'error'
}

export interface AppState {
  workspace: WorkspaceState
  /** When true, task commands use the local mock queue instead of bundled takt projection. */
  mockQueueEnabled: boolean
  /** Set when `.planetz/orbit` canonical files are missing but project compat sources exist. */
  canonicalImportOffer?: CanonicalImportOffer | null
  connection: ConnectionState
  agents: AgentState[]
  /** Projected execution subjects derived from task/run/workflow attribution. */
  executors: ExecutorState[]
  workflows: WorkflowSummary[]
  /** Display order for builtin workflow categories (from workflow-categories.yaml). */
  builtinWorkflowCategoryOrder?: string[]
  tasks: TaskViewModel[]
  retries: TaskViewModel[]
  results: ResultSummary[]
  selectedTaskId?: string
  /** v0.3 experimental — not part of v0.2 acceptance. */
  chains: ChainGroup[]
  /** v0.3 experimental — not part of v0.2 acceptance. */
  integrations: IntegrationsState
  /** SDD backlog + kiro phase snapshot after workspace open (PR-11). */
  sddOpen?: SddOpenSnapshot | null
}

export interface PromptDraft {
  title: string
  body: string
  workflow?: string
  assignedAgentId?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

export interface TaskOrder extends PromptDraft {
  id: string
  source: 'user' | 'takt' | 'external'
  createdAt: string
  dependsOnTaskId?: string
  chainId?: string
}

export interface PromptHistoryItem {
  id: string
  title: string
  body: string
  workflow?: string
  autoDecision?: AutoWorkflowDecision
  assignedAgentId?: string
  issueRef?: string
  submittedTaskId?: string
  status: 'draft' | 'submitted' | 'discarded'
  createdAt: string
  updatedAt: string
}

export type WorkflowMode = 'manual' | 'auto'

export type AutoWorkflowConfidence = 'high' | 'medium' | 'low'

export interface AutoWorkflowAlternative {
  name: string
  group: string
  score: number
}

export type AutoWorkflowLlmFailureCode =
  | 'timeout'
  | 'invalid-json'
  | 'invalid-workflow'
  | 'provider-error'

export interface AutoWorkflowDecisionLlmMeta {
  provider?: string
  model?: string
  latencyMs?: number
  failureCode?: AutoWorkflowLlmFailureCode
}

export interface AutoWorkflowDecision {
  selectedWorkflow: string
  group: string
  confidence: AutoWorkflowConfidence
  score: number
  fallbackApplied: boolean
  alternatives: AutoWorkflowAlternative[]
  reasonCodes: string[]
  llm?: AutoWorkflowDecisionLlmMeta
}

export interface EnqueueTaskResult {
  taskId: string
  autoDecision?: AutoWorkflowDecision
}

export interface ConversationEntry {
  id: string
  taskId: string
  role: 'user' | 'system'
  kind: 'initial_order' | 'retry' | 'resume' | 'revise' | 'note'
  body: string
  createdAt: string
}

/** One assistant turn in Composer Assist. */
export interface ComposerAssistantTurn {
  sessionId: string
  /** Legacy Q/A UI; empty when using free-form conversation. */
  question: string
  recommendedAnswer: string
  /** Free-form assistant reply (headless interactive). */
  assistantMessage?: string
  turnIndex: number
  readyToFinalize: boolean
  /** Set when context compaction ran or blocked an orbit turn (P4). */
  compactionSummary?: ConversationCompactionSummary
}

/** Finalized task body from Composer Assist. */
export interface ComposerAssistantFinalizeResult {
  sessionId: string
  body: string
  allowedActions?: Array<'execute' | 'save_task' | 'continue'>
}

/** Chat line for Assist panel conversation log. */
export interface ComposerAssistConversationLine {
  role: 'user' | 'assistant'
  content: string
}

/** One Q/A row restored in the Assist panel. */
export interface ComposerAssistTurnRecord {
  question: string
  recommendedAnswer: string
  userReply?: string
}

/** Active Assist session returned for resume (no new LLM call). */
export interface ComposerAssistActiveSession {
  sessionId: string
  mode?: 'planning-only' | 'interactive-assistant'
  workflow?: string
  seedBody?: string
  provider?: string
  model?: string
  effort?: string
  sessionPolicy?: import('./orbit-interactive-contract.js').PlanetzSessionPolicy
  turns: ComposerAssistTurnRecord[]
  /** Headless interactive conversation log. */
  conversation?: ComposerAssistConversationLine[]
  readyToFinalize: boolean
  turnIndex: number
}

export interface TaskVisual {
  label: string
  accentToken: string
  iconId?: string
}

export interface AgentVisual {
  label: string
  accentToken: string
  avatarId?: string
}

/** Logical panel identifiers (skin-neutral). Used by `SkinDefinition.panelTitles`. */
export type PanelId =
  | 'agents'
  | 'tasks'
  | 'retries'
  | 'results'
  | 'detail'
  | 'overview'
  | 'composer'

export interface SkinDefinition {
  id: string
  displayName: string
  mapTaskVisual(task: TaskViewModel): TaskVisual
  mapAgentVisual(agent: AgentState): AgentVisual
  tokens: Record<string, string>

  /**
   * Skin extensions (optional). default / operations skins omit these and
   * fall back to canonical English labels in components.
   */
  panelTitles?: Partial<Record<PanelId, string>>
  taskStatusLabel?: (status: TaskStatus) => string
  agentStatusLabel?: (status: AgentStatus) => string
  roleLabel?: (role: AgentState['role']) => string
}
