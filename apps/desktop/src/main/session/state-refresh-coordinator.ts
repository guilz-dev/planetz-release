import type {
  AgentOverrides,
  AgentState,
  AppState,
  CanonicalImportOffer,
  ConnectionState,
  EngineConfig,
  ExecutionProfile,
  RunEvent,
  SddOpenSnapshot,
  TaskViewModel,
  UiConfig,
  UiState,
  WorkspaceBootstrapStatus,
} from '@planetz/shared'
import type { IntegrationsService } from '../integrations/integrations-service.js'
import {
  enrichResultSummariesWithPullRequests,
  taskPrLinksToMap,
} from '../lib/projection/result-pr-projection.js'
import { shallowStringRecordEqual } from '../lib/projection/run-projection.js'
import { attachWorkflowSelectionMeta } from '../lib/projection/workflow-selection-projection.js'
import type { PendingRunNowAttribution } from '../lib/run-now-attribution-backfill.js'
import { tryBackfillRunNowAssignment } from '../lib/run-now-attribution-backfill.js'
import { MOCK_AGENTS } from '../mock/mock-data.js'
import { collectMockRunEvents, collectMockRunTraces } from '../mock/run-events-mock.js'
import type { WorkflowMockManager } from '../mock/workflow-mock-manager.js'
import { MOCK_WORKFLOWS } from '../mock/workflows-mock.js'
import type { PlanetzWorkflowCanonicalManager } from '../planetz/workflow-canonical-manager.js'
import type { SidecarPaths } from '../sidecar/sidecar-store.js'
import type { TaskPrLinkStore } from '../sidecar/task-pr-link-store.js'
import { buildProductionProjection, projectAppState } from '../state-projector.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { listTaskWorkflowSelectionMeta } from '../storage/sqlite/repositories/task-workflow-selection-meta-repository.js'
import { getBuiltinWorkflowCategoryOrder } from '../takt/builtin-workflow-registry.js'
import type { ChainCoordinator } from './chain-coordinator.js'
import type { TaskYamlRefreshAccess } from './task-yaml-access.js'
export interface StateRefreshPort {
  workspacePath: string | null
  taktExecutionPath: string | null
  sidecarPaths: SidecarPaths | null
  config: UiConfig | null
  uiState: UiState
  connection: ConnectionState
  mockTasks: TaskViewModel[]
  bootstrapOverride: WorkspaceBootstrapStatus | null
  canonicalImportOffer: CanonicalImportOffer | null
  cachedState: AppState | null
  readonly taskCatalog: TaskYamlRefreshAccess
  readonly chainCoordinator: ChainCoordinator
  readonly integrationsService: IntegrationsService
  readonly taskPrLinkStore: TaskPrLinkStore
  mockQueueEnabled(): boolean
  get workflowManager(): WorkflowMockManager | PlanetzWorkflowCanonicalManager
  persistUiState(patch: Partial<UiState>): Promise<void>
  onTasksUpdatedForModelHistory(tasks: TaskViewModel[]): Promise<void>
  loadProjectionContext(): Promise<{
    engine: EngineConfig
    agentOverrides: AgentOverrides
    pendingProfilesByTaskId: ReadonlyMap<string, ExecutionProfile>
  }>
  pendingRunNowAttribution: PendingRunNowAttribution | null
  setPendingRunNowAttribution(pending: PendingRunNowAttribution | null): void
  trackTaskExecutionProfile(taskId: string, profile: ExecutionProfile): void
  setCachedRunEvents(runEvents: RunEvent[]): void
  getSddOpenSnapshot(): Promise<SddOpenSnapshot | null>
}

export class StateRefreshCoordinator {
  constructor(private readonly port: StateRefreshPort) {}

  getState(): AppState | null {
    return this.port.cachedState
  }

  async refreshAndNotify(onStateChange?: () => void): Promise<AppState> {
    const state = await this.refreshState()
    onStateChange?.()
    return state
  }

  async refreshState(): Promise<AppState> {
    if (!this.port.workspacePath || !this.port.sidecarPaths || !this.port.config) {
      throw new Error('No workspace open')
    }
    const paths = this.port.sidecarPaths
    this.port.taskCatalog.invalidate()

    if (this.port.mockQueueEnabled()) {
      const projectionContext = await this.port.loadProjectionContext()
      const taskIds = new Set(this.port.mockTasks.map((t) => t.id))
      let mockTasksWithWorkflowMeta = this.port.mockTasks
      if (paths.sqlitePath) {
        const db = await getSidecarSqlite(paths)
        const workflowSelectionMeta = listTaskWorkflowSelectionMeta(db, taskIds)
        mockTasksWithWorkflowMeta = attachWorkflowSelectionMeta(
          this.port.mockTasks,
          workflowSelectionMeta,
        )
      }
      const tasksById = new Map(mockTasksWithWorkflowMeta.map((t) => [t.id, t]))
      const chains = await this.port.chainCoordinator.reconcileAndPersist(paths, taskIds, tasksById)
      const mockRunEvents = collectMockRunEvents()
      const mockRunTraces = collectMockRunTraces()
      this.port.setCachedRunEvents(mockRunEvents)
      this.port.cachedState = projectAppState({
        workspacePath: this.port.workspacePath,
        taktExecutionPath: undefined,
        sidecarPath: paths.root,
        isWritable: paths.isWorkspaceLocal,
        config: this.port.config,
        uiState: this.port.uiState,
        connection: this.port.connection,
        tasks: mockTasksWithWorkflowMeta,
        workflows: MOCK_WORKFLOWS,
        executorTemplates: MOCK_AGENTS,
        engine: projectionContext.engine,
        agentOverrides: projectionContext.agentOverrides,
        pendingProfilesByTaskId: projectionContext.pendingProfilesByTaskId,
        chains,
        integrations: this.port.integrationsService.getState(),
        runEvents: mockRunEvents,
        runTraces: mockRunTraces,
        bootstrapOverride: this.port.bootstrapOverride ?? undefined,
        mockQueueEnabled: true,
        sddOpen: (await this.port.getSddOpenSnapshot()) ?? undefined,
      })
      this.applyIntegrationAgentOverlays()
      await this.port.onTasksUpdatedForModelHistory(this.port.cachedState.tasks)
    } else {
      const taktRepo = this.port.taktExecutionPath ?? this.port.workspacePath
      let tasksFromYaml = await this.port.taskCatalog.loadCached(taktRepo, this.port.config)
      const pendingAttribution = this.port.pendingRunNowAttribution
      const backfill = tryBackfillRunNowAssignment(
        tasksFromYaml,
        pendingAttribution,
        this.port.uiState,
      )
      if (backfill.taskAssignments) {
        await this.port.persistUiState({ taskAssignments: backfill.taskAssignments })
        // Same refresh-cycle cache; yaml unchanged — reload cached snapshot for projection input.
        tasksFromYaml = await this.port.taskCatalog.loadCached(taktRepo, this.port.config)
      }
      if (backfill.matchedTaskId && pendingAttribution?.profile) {
        this.port.trackTaskExecutionProfile(backfill.matchedTaskId, pendingAttribution.profile)
      }
      if (backfill.clearPending) {
        this.port.setPendingRunNowAttribution(null)
      }
      const projectionContext = await this.port.loadProjectionContext()
      const taskIds = this.port.taskCatalog.idSet(tasksFromYaml)
      const db = await getSidecarSqlite(paths)
      const workflowSelectionMeta = listTaskWorkflowSelectionMeta(db, taskIds)
      const tasksWithWorkflowMeta = attachWorkflowSelectionMeta(
        tasksFromYaml,
        workflowSelectionMeta,
      )
      const chains = await this.port.chainCoordinator.reconcileAndPersist(
        paths,
        taskIds,
        new Map(tasksWithWorkflowMeta.map((t) => [t.id, t])),
      )
      const workflows = await this.port.workflowManager.list()
      const executorTemplates: AgentState[] =
        this.port.integrationsService.buildIntegrationAgentTemplates()
      const { state, runEvents } = await buildProductionProjection({
        workspacePath: this.port.workspacePath,
        taktExecutionPath: taktRepo,
        sidecarPath: paths.root,
        isWritable: paths.isWorkspaceLocal,
        config: this.port.config,
        uiState: this.port.uiState,
        connection: this.port.connection,
        workflows,
        builtinWorkflowCategoryOrder: [...getBuiltinWorkflowCategoryOrder()],
        executorTemplates,
        engine: projectionContext.engine,
        agentOverrides: projectionContext.agentOverrides,
        pendingProfilesByTaskId: projectionContext.pendingProfilesByTaskId,
        chains,
        integrations: this.port.integrationsService.getState(),
        tasksFromYaml: tasksWithWorkflowMeta,
        bootstrapOverride: this.port.bootstrapOverride ?? undefined,
        mockQueueEnabled: false,
        sddOpen: (await this.port.getSddOpenSnapshot()) ?? undefined,
      })
      this.port.setCachedRunEvents(runEvents)
      this.port.cachedState = state
      await this.syncActiveRunUiState(this.port.cachedState.tasks)
      this.applyIntegrationAgentOverlays()
      await this.port.onTasksUpdatedForModelHistory(this.port.cachedState.tasks)
    }
    await this.enrichCachedResultsWithPullRequests(paths)
    this.port.cachedState = {
      ...this.port.cachedState,
      canonicalImportOffer: this.port.canonicalImportOffer,
    }
    return this.port.cachedState
  }

  private async enrichCachedResultsWithPullRequests(paths: SidecarPaths): Promise<void> {
    if (!this.port.cachedState) return
    try {
      const links = await this.port.taskPrLinkStore.list(paths)
      const linksByTaskId = taskPrLinksToMap(links)
      this.port.cachedState = {
        ...this.port.cachedState,
        results: enrichResultSummariesWithPullRequests(
          this.port.cachedState.results,
          linksByTaskId,
        ),
      }
    } catch (error) {
      console.warn('[planetz] result pr enrich skipped', error)
    }
  }

  /** Temporary adapter diagnostics from Integrations test push (not task attribution). */
  private applyIntegrationAgentOverlays(): void {
    if (!this.port.cachedState) return
    this.port.cachedState = {
      ...this.port.cachedState,
      agents: this.port.integrationsService.applyAgentOverlays(this.port.cachedState.agents),
    }
  }

  private async syncActiveRunUiState(tasks: TaskViewModel[]): Promise<void> {
    const paths = this.port.sidecarPaths
    if (!paths) return
    const activeRunByTaskId: Record<string, string> = {}
    for (const task of tasks) {
      if (task.activeRunId) activeRunByTaskId[task.id] = task.activeRunId
    }
    const prev = this.port.uiState.activeRunByTaskId ?? {}
    if (shallowStringRecordEqual(activeRunByTaskId, prev)) return
    await this.port.persistUiState({ activeRunByTaskId })
  }
}
