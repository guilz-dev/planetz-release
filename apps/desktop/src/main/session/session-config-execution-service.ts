import {
  type AgentOverrides,
  type AgentOverridesUpdateInput,
  applyEngineConfigPatch,
  buildEffectiveEngineConfig,
  type EngineConfig,
  type EngineConfigUpdateInput,
  type EnqueueTaskInput,
  type ExecutionCatalog,
  type ExecutionProfile,
  finalizeEngineConfigForPersist,
  type ListProviderEffortsInput,
  type ListProviderModelsInput,
  mergeEngineConfigPreview,
  planetzAgentOverridesRelPath,
  planetzEngineConfigRelPath,
  readLastSelectedModelForProvider,
  type TaskViewModel,
  type UiPreferences,
} from '@planetz/shared'
import type { AppSession } from '../app-session.js'
import {
  buildResolveTaskResultInput,
  taskResultInputSourceFromSession,
} from '../lib/task-result-input.js'
import {
  importEngineConfigFromTakt,
  importGlobalTaktFromHomeForWorkspace,
} from '../planetz/canonical-bootstrap.js'
import { loadEffectiveEngineConfig } from '../planetz/effective-engine-config.js'
import {
  resolveExecutionProfileForEnqueue,
  workflowDefaultsForName,
} from '../planetz/execution-profile-resolver.js'

const EXECUTION_CATALOG_CACHE_MS = 5_000

/**
 * Engine config, agent overrides, execution catalog cache, and provider model/effort surfaces.
 * Extracted from AppSession to keep the facade thin.
 */
export class SessionConfigExecutionService {
  private executionCatalogSnapshot: { catalog: ExecutionCatalog; fetchedAt: number } | null = null

  constructor(private readonly session: AppSession) {}

  invalidateExecutionCatalogCache(): void {
    this.executionCatalogSnapshot = null
  }

  async loadProjectionContext(): Promise<{
    engine: EngineConfig
    agentOverrides: AgentOverrides
    pendingProfilesByTaskId: ReadonlyMap<string, ExecutionProfile>
  }> {
    const paths = this.session.requireSidecarPaths()
    const engine = await loadEffectiveEngineConfig(
      this.session.engineConfigStore,
      this.session.agentOverridesStore,
      paths,
    )
    const agentOverrides = await this.session.agentOverridesStore.load(paths)
    return {
      engine,
      agentOverrides,
      pendingProfilesByTaskId: this.session.modelHistoryTracker.snapshotPendingProfiles(),
    }
  }

  async getEngineConfig(): Promise<{ config: EngineConfig; path: string }> {
    const paths = this.session.requireSidecarPaths()
    const config = await this.session.engineConfigStore.load(paths)
    return { config, path: planetzEngineConfigRelPath() }
  }

  async getAgentOverrides(): Promise<{ overrides: AgentOverrides; path: string }> {
    const paths = this.session.requireSidecarPaths()
    const overrides = await this.session.agentOverridesStore.load(paths)
    return { overrides, path: planetzAgentOverridesRelPath() }
  }

  async updateAgentOverrides(patch: AgentOverridesUpdateInput): Promise<{
    overrides: AgentOverrides
    path: string
    engineConfig: EngineConfig
    effectiveEngineConfig: EngineConfig
  }> {
    const paths = this.session.requireSidecarPaths()
    const current = await this.session.agentOverridesStore.load(paths)
    const next: AgentOverrides = { ...current, ...patch }
    if ('persona_providers' in patch && !patch.persona_providers) {
      delete next.persona_providers
    }
    const saved = await this.session.agentOverridesStore.save(paths, next)
    const engine = await this.session.engineConfigStore.load(paths)
    const effectiveEngineConfig = buildEffectiveEngineConfig(engine, saved)
    this.invalidateExecutionCatalogCache()
    await this.session.workspaceRuntime.restartWatchIfRunning()
    return {
      overrides: saved,
      path: planetzAgentOverridesRelPath(),
      engineConfig: engine,
      effectiveEngineConfig,
    }
  }

  /** Effective engine config (sidecar + agent overrides). */
  loadEffectiveEngineConfig(): Promise<EngineConfig> {
    return loadEffectiveEngineConfig(
      this.session.engineConfigStore,
      this.session.agentOverridesStore,
      this.session.requireSidecarPaths(),
    )
  }

  private async resolveEffectiveEngineConfig(): Promise<EngineConfig> {
    return this.loadEffectiveEngineConfig()
  }

  async listExecutionCatalog(): Promise<ExecutionCatalog> {
    const paths = this.session.requireSidecarPaths()
    const engineConfig = await this.resolveEffectiveEngineConfig()
    const { loadWorkspaceExecutionCatalog } = await import(
      '../planetz/execution-catalog-service.js'
    )
    return loadWorkspaceExecutionCatalog({
      engineConfig,
      planetzWorkflowsDir: paths.planetzWorkflowsDir,
      workspacePath: this.session.requireWorkspacePath(),
      config: this.session.requireConfig(),
    })
  }

  private async getExecutionCatalogCached(): Promise<ExecutionCatalog> {
    const now = Date.now()
    if (
      this.executionCatalogSnapshot &&
      now - this.executionCatalogSnapshot.fetchedAt < EXECUTION_CATALOG_CACHE_MS
    ) {
      return this.executionCatalogSnapshot.catalog
    }
    const catalog = await this.listExecutionCatalog()
    this.executionCatalogSnapshot = { catalog, fetchedAt: now }
    return catalog
  }

  async listProviderModels(input: ListProviderModelsInput) {
    const paths = this.session.requireSidecarPaths()
    const [catalog, effectiveEngineConfig] = await Promise.all([
      this.getExecutionCatalogCached(),
      this.resolveEffectiveEngineConfig(),
    ])
    const engineConfig = mergeEngineConfigPreview(effectiveEngineConfig, input.engineConfigPreview)
    const lastSelectedModel = readLastSelectedModelForProvider(this.session.uiState, input.provider)
    const workflowDefaults = await workflowDefaultsForName(
      this.session.canonicalWorkflowManager,
      input.workflowName,
    )
    return this.session.providerModelsService.listProviderModels({
      paths,
      provider: input.provider,
      catalog,
      engineConfig,
      workflowDefaults,
      currentModel: input.currentModel,
      lastSelectedModel,
      refresh: input.refresh,
    })
  }

  listModelHistory(provider?: string) {
    const paths = this.session.requireSidecarPaths()
    return this.session.providerModelsService.listModelHistory(paths, provider)
  }

  deleteModelHistoryItem(input: { provider: string; model: string }) {
    const paths = this.session.requireSidecarPaths()
    return this.session.providerModelsService.deleteModelHistoryItem(paths, input)
  }

  async listProviderEfforts(input: ListProviderEffortsInput) {
    const paths = this.session.requireSidecarPaths()
    const [catalog, engineConfig] = await Promise.all([
      this.getExecutionCatalogCached(),
      this.resolveEffectiveEngineConfig(),
    ])
    const workflowDefaults = await workflowDefaultsForName(
      this.session.canonicalWorkflowManager,
      input.workflowName,
    )
    return this.session.providerEffortsService.listProviderEfforts({
      paths,
      provider: input.provider,
      catalog,
      engineConfig,
      workflowDefaults,
      currentEffort: input.currentEffort,
    })
  }

  listEffortHistory(provider?: string) {
    const paths = this.session.requireSidecarPaths()
    return this.session.providerEffortsService.listEffortHistory(paths, provider)
  }

  deleteEffortHistoryItem(input: { provider: string; effort: string }) {
    const paths = this.session.requireSidecarPaths()
    return this.session.providerEffortsService.deleteEffortHistoryItem(paths, input)
  }

  resolveExecutionProfileForInput(input: EnqueueTaskInput): Promise<ExecutionProfile> {
    return resolveExecutionProfileForEnqueue(
      this.session.engineConfigStore,
      this.session.agentOverridesStore,
      this.session.requireSidecarPaths(),
      this.session.canonicalWorkflowManager,
      input,
    )
  }

  trackTaskExecutionProfile(taskId: string, profile: ExecutionProfile): void {
    this.session.modelHistoryTracker.trackPendingTask(taskId, profile)
    this.session.effortHistoryTracker.trackPendingTask(taskId, profile)
  }

  async recordExecutionSuccess(profile: ExecutionProfile): Promise<void> {
    const paths = this.session.requireSidecarPaths()
    await Promise.all([
      this.session.modelHistoryTracker.recordSuccess(paths, profile),
      this.session.effortHistoryTracker.recordSuccess(paths, profile),
    ])
  }

  async onTasksUpdatedForModelHistory(tasks: TaskViewModel[]): Promise<void> {
    const paths = this.session.sidecarPaths
    if (!paths) return
    await Promise.all([
      this.session.modelHistoryTracker.onTasksUpdated(paths, tasks),
      this.session.effortHistoryTracker.onTasksUpdated(paths, tasks),
      this.session.intentLedgerTracker.onTasksUpdated(paths, tasks, (taskId) =>
        buildResolveTaskResultInput(taskResultInputSourceFromSession(this.session), taskId),
      ),
    ])
  }

  resetModelHistoryTracker(): void {
    this.session.modelHistoryTracker.reset()
    this.session.effortHistoryTracker.reset()
    this.session.intentLedgerTracker.reset()
    this.session.taskFailureNotificationTracker.reset()
  }

  async updateEngineConfig(patch: EngineConfigUpdateInput): Promise<{
    config: EngineConfig
    path: string
  }> {
    const paths = this.session.requireSidecarPaths()
    const current = await this.session.engineConfigStore.load(paths)
    const merged = applyEngineConfigPatch(current, patch)
    const saved = await this.persistEngineConfigWithUiDefaults(merged)
    return { config: saved, path: planetzEngineConfigRelPath() }
  }

  private async persistEngineConfigWithUiDefaults(config: EngineConfig): Promise<EngineConfig> {
    const paths = this.session.requireSidecarPaths()
    const uiLanguage = this.session.requireConfig().ui.language
    const next = finalizeEngineConfigForPersist(config, uiLanguage)
    const saved = await this.session.engineConfigStore.save(paths, next)
    this.invalidateExecutionCatalogCache()
    await this.session.workspaceRuntime.restartWatchIfRunning()
    return saved
  }

  async syncEngineConfigWithUiLanguage(uiLanguage: UiPreferences['language']): Promise<void> {
    if (!this.session.sidecarPaths) return
    const current = await this.session.engineConfigStore.load(this.session.sidecarPaths)
    const next = finalizeEngineConfigForPersist(current, uiLanguage)
    if (next.language === current.language && next.concurrency === current.concurrency) {
      return
    }
    await this.persistEngineConfigWithUiDefaults(current)
  }

  async importEngineConfigFromTakt(options?: {
    overwrite?: boolean
  }): Promise<{ config: EngineConfig; path: string; overwritten: boolean }> {
    const paths = this.session.requireSidecarPaths()
    const result = await importEngineConfigFromTakt(
      this.session.requireWorkspacePath(),
      this.session.requireConfig(),
      paths,
      {
        ...options,
        taktRepoPath: this.session.isolatedTaktWorkspace?.isolatedRepoPath,
      },
    )
    const raw = await this.session.engineConfigStore.load(paths)
    const config = await this.persistEngineConfigWithUiDefaults(raw)
    return { config, path: planetzEngineConfigRelPath(), overwritten: result.overwritten }
  }

  async importGlobalTaktFromHome(options?: {
    overwrite?: boolean
  }): Promise<{ configImported: boolean; workflowsImported: string[] }> {
    const paths = this.session.requireSidecarPaths()
    const result = await importGlobalTaktFromHomeForWorkspace(
      this.session.requireWorkspacePath(),
      paths,
      options,
    )
    this.invalidateExecutionCatalogCache()
    await this.session.workspaceRuntime.restartWatchIfRunning()
    return result
  }
}
