import type {
  AppState,
  ConnectionState,
  EngineConfig,
  EnqueueTaskInput,
  ExecutionProfile,
  KiroRoutingContext,
  TaskViewModel,
  UiConfig,
  UiState,
  WorkflowRoutingCatalog,
  WorkflowSource,
  WorkflowSummary,
} from '@planetz/shared'
import type { PendingRunNowAttribution } from '../lib/run-now-attribution-backfill.js'
import type { ConversationStore } from '../sidecar/conversation-store.js'
import type { MockQueueStore } from '../sidecar/mock-queue-store.js'
import type { PromptHistoryStore } from '../sidecar/prompt-history-store.js'
import type { RetryContextStore } from '../sidecar/retry-context-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-store.js'
import type { TaktConnectorCli } from '../takt/connector-cli.js'
import type { TaskYamlCommandAccess } from './task-yaml-access.js'
import type { WorkflowRoutingFeatureCache } from './workflow-auto/routing-feature-cache.js'

export interface TaskCommandPort extends TaskYamlCommandAccess {
  workspacePath: string | null
  sidecarPaths: SidecarPaths | null
  config: UiConfig | null
  uiState: UiState
  connection: ConnectionState
  mockTasks: TaskViewModel[]
  connector: TaktConnectorCli | null
  readonly mockQueueStore: MockQueueStore
  readonly conversationStore: ConversationStore
  readonly promptHistoryStore: PromptHistoryStore
  readonly retryContextStore: RetryContextStore
  resolveExecutionProfileForInput(input: EnqueueTaskInput): Promise<ExecutionProfile>
  loadEffectiveEngineConfig(): Promise<EngineConfig>
  trackTaskExecutionProfile(taskId: string, profile: ExecutionProfile): void
  recordExecutionSuccess(profile: ExecutionProfile): Promise<void>
  mockQueueEnabled(): boolean
  refreshState(): Promise<AppState>
  syncUiState(state: UiState): void
  persistUiState(patch: Partial<UiState>): Promise<void>
  setPendingRunNowAttribution(pending: PendingRunNowAttribution | null): void
  requireSidecarPaths(): SidecarPaths
  requireWorkspacePath(): string
  /** Repo path where `.takt/tasks.yaml` lives (isolated clone when enabled). */
  requireTaktRepoPath(): string
  requireConfig(): UiConfig
  /** Reconcile connection.watch after stop; clears stale watch KV when the stopped PID was watch. */
  syncWatchConnection(stoppedPid: number): Promise<void>
  listAvailableWorkflowNames(): Promise<string[]>
  listWorkflowSummaries(): Promise<Array<Pick<WorkflowSummary, 'name' | 'source'>>>
  loadWorkflowRoutingCatalog(): Promise<WorkflowRoutingCatalog>
  readWorkflowYaml(workflowName: string): Promise<string | null>
  readWorkflowDocument(
    nameOrPath: string,
    source?: 'builtin' | 'project' | 'user' | 'imported',
  ): Promise<{ yaml: string; source: WorkflowSource }>
  readonly workflowRoutingFeatureCache: WorkflowRoutingFeatureCache
  regenerateEstablishedDecisionsForTask(
    input: Pick<EnqueueTaskInput, 'title' | 'body'>,
  ): Promise<string[]>
  regenerateDecidedIntentContextForTask(taskId: string): Promise<boolean>
  upsertTaskSupplySnapshot(taskId: string, entryIds: readonly string[]): Promise<void>
  resolveKiroRoutingContext(): Promise<KiroRoutingContext | null>
}
