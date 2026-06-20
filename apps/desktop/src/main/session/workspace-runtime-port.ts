import type {
  AppState,
  CanonicalImportOffer,
  ConnectionState,
  RunEvent,
  TaskViewModel,
  UiConfig,
  UiPreferences,
  UiState,
  WorkspaceBootstrapStatus,
} from '@planetz/shared'
import type { IntegrationsService } from '../integrations/integrations-service.js'
import type { AgentOverridesStore } from '../planetz/agent-overrides-store.js'
import type { EngineConfigStore } from '../planetz/engine-config-store.js'
import type { IsolatedTaktWorkspace } from '../planetz/isolated-takt-workspace.js'
import type { OllamaHealthMonitor } from '../planetz/ollama-health-monitor.js'
import type { PlanetzWorkflowCanonicalManager } from '../planetz/workflow-canonical-manager.js'
import type { WorkflowRoutingCatalogStore } from '../planetz/workflow-routing-catalog.js'
import type { MockQueueStore } from '../sidecar/mock-queue-store.js'
import type { SidecarPaths, SidecarStore } from '../sidecar/sidecar-store.js'
import type { WorkspaceSessionStore } from '../sidecar/workspace-session-store.js'
import type { TaktConnectorCli } from '../takt/connector-cli.js'
import type { WatchManager } from '../takt/watch-manager.js'
import type { ChainCoordinator } from './chain-coordinator.js'
import type { ComposerAssistantService } from './composer-assistant-service.js'
import type { TaskCatalog } from './task-catalog.js'
import type { WorkflowRoutingFeatureCache } from './workflow-auto/routing-feature-cache.js'

export type GlobalUiPreferences = Pick<UiPreferences, 'theme' | 'counterPackEnabled' | 'language'>

/** Connection state before any workspace is opened (matches AppSession defaults). */
export function createInitialConnectionState(): ConnectionState {
  return { cli: 'unknown', watch: 'unknown' }
}

/** UI state before sidecar load during workspace open. */
export function createInitialUiState(): UiState {
  return {}
}

export function applyGlobalUiPreferences(
  config: UiConfig,
  globalUi: GlobalUiPreferences,
): UiConfig {
  return {
    ...config,
    ui: {
      ...config.ui,
      theme: globalUi.theme,
      counterPackEnabled: globalUi.counterPackEnabled,
      language: globalUi.language,
    },
  }
}

export interface WorkspaceRuntimePort {
  workspacePath: string | null
  isolatedTaktWorkspace: IsolatedTaktWorkspace | null
  sidecarPaths: SidecarPaths | null
  config: UiConfig | null
  uiState: UiState
  connection: ConnectionState
  mockTasks: TaskViewModel[]
  bootstrapOverride: WorkspaceBootstrapStatus | null
  canonicalImportOffer: CanonicalImportOffer | null
  cachedState: AppState | null
  setCachedRunEvents(runEvents: RunEvent[]): void
  stopRunsWatcher: (() => void) | null
  connector: TaktConnectorCli | null
  watchManager: WatchManager | null
  canonicalWorkflowManager: PlanetzWorkflowCanonicalManager | null
  workflowRoutingCatalogStore: WorkflowRoutingCatalogStore | null
  readonly workflowRoutingFeatureCache: WorkflowRoutingFeatureCache
  readonly integrationsService: IntegrationsService
  readonly sidecarStore: SidecarStore
  readonly mockQueueStore: MockQueueStore
  readonly engineConfigStore: EngineConfigStore
  readonly agentOverridesStore: AgentOverridesStore
  readonly workspaceSessionStore: WorkspaceSessionStore
  readonly taskCatalog: TaskCatalog
  readonly chainCoordinator: ChainCoordinator
  readonly composerAssistantService: ComposerAssistantService
  readonly ollamaHealthMonitor: OllamaHealthMonitor
  mockQueueEnabled(): boolean
  loadEffectiveEngineConfig(): Promise<import('@planetz/shared').EngineConfig>
  refreshState(): Promise<AppState>
  refreshAndNotify(): Promise<void>
  persistUiState(patch: Partial<UiState>): Promise<void>
  requireSidecarPaths(): SidecarPaths
  requireWorkspacePath(): string
  requireConfig(): UiConfig
  requireCanonicalWorkflowManager(): PlanetzWorkflowCanonicalManager
  resetModelHistoryTracker(): void
  invalidateExecutionCatalogCache(): void
  invalidateWorkflowRoutingCaches(): void
  clearKiroSpecsCache(): void
  rebuildSddOpenSnapshot(): Promise<import('@planetz/shared').SddOpenSnapshot | null>
  invalidateSddOpenSnapshot(): void
}
