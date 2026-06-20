import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type AppState,
  PROMPT_HISTORY_MAX_ITEMS,
  type RecentWorkspace,
  type WorkspaceBootstrapStatus,
} from '@planetz/shared'
import { HookServerStartError } from '../integrations/hook-server-errors.js'
import { migrateTasksToDirectExecutionIfNeeded } from '../lib/migrate-tasks-direct-execution.js'
import { rescueLegacyHomeDraftsIfNeeded } from '../lib/workflow-draft-store.js'
import { initializeWorkspace } from '../lib/workspace-init.js'
import { MOCK_TASKS } from '../mock/mock-data.js'
import {
  applyCanonicalImport,
  ensureCanonicalScaffold,
  ensureEmptyEngineConfigIfMissing,
  previewCanonicalImport,
} from '../planetz/canonical-bootstrap.js'
import { ensureProductBuiltinWorkflows } from '../planetz/default-workflow-bootstrap.js'
import { ensureIsolatedTaktWorkspace } from '../planetz/isolated-takt-workspace.js'
import { migrateLegacyMainTaktFacetsToOrbitIfNeeded } from '../planetz/orbit-facets-migrate.js'
import { upgradeInstalledSpecDrivenWorkflowIfStale } from '../planetz/spec-driven-installer.js'
import { PlanetzWorkflowCanonicalManager } from '../planetz/workflow-canonical-manager.js'
import { ensureWorkflowRoutingCatalogSeeded } from '../planetz/workflow-routing-bootstrap.js'
import { WorkflowRoutingCatalogStore } from '../planetz/workflow-routing-catalog.js'
import {
  mergeNewWorkflowsIntoRoutingCatalog,
  reconcileBuiltinAutoEligibilityInCatalog,
  reconcileRoutingGroupsInCatalog,
  reconcileRoutingMetadataInCatalog,
} from '../planetz/workflow-routing-catalog-merge.js'
import { PromptHistoryStore } from '../sidecar/prompt-history-store.js'
import { resolveSidecarPaths } from '../sidecar/sidecar-store.js'
import { closeSidecarSqlite, openSidecarSqlite } from '../storage/sqlite/connection.js'
import { BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML } from '../takt/builtin-workflow-yaml.js'
import { checkTaktCli } from '../takt/connection-check.js'
import { TaktConnectorCli } from '../takt/connector-cli.js'
import { isPendingDirectMigrationEnabled } from '../takt/enqueue-mode.js'
import { WatchManager } from '../takt/watch-manager.js'
import {
  applyImplicitLibraryWorkflowMigration,
  collectImplicitWorkflowUsageCandidates,
} from './workflow-implicit-enable-migration.js'
import {
  collectReferencedRuntimeWorkflowNames,
  gcOrphanRuntimeWorkflowFiles,
} from './workflow-selection/runtime-workflow-gc.js'
import type { WorkspaceRuntimeEnvService } from './workspace-runtime-env-service.js'
import {
  applyGlobalUiPreferences,
  createInitialConnectionState,
  createInitialUiState,
  type GlobalUiPreferences,
  type WorkspaceRuntimePort,
} from './workspace-runtime-port.js'
import type { WorkspaceWatchService } from './workspace-watch-service.js'

const promptHistoryStore = new PromptHistoryStore()

export class WorkspaceOpenService {
  /** Serialize workspace runtime mutations so overlapping switches cannot tear shared state down. */
  private workspaceTransitionQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly port: WorkspaceRuntimePort,
    private readonly env: WorkspaceRuntimeEnvService,
    private readonly watch: WorkspaceWatchService,
  ) {}

  openWorkspace(workspacePath: string): Promise<AppState> {
    return this.runExclusiveWorkspaceTransition(() => this.openWorkspaceInternal(workspacePath))
  }

  private runExclusiveWorkspaceTransition<T>(action: () => Promise<T>): Promise<T> {
    const next = this.workspaceTransitionQueue.then(action, action)
    this.workspaceTransitionQueue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  private async openWorkspaceInternal(workspacePath: string): Promise<AppState> {
    await this.teardownWorkspaceRuntimeInternal()
    try {
      this.port.workspacePath = workspacePath
      this.port.isolatedTaktWorkspace = await ensureIsolatedTaktWorkspace(workspacePath)
      await rescueLegacyHomeDraftsIfNeeded(workspacePath)
      this.port.sidecarPaths = await resolveSidecarPaths(workspacePath)
      await openSidecarSqlite(this.port.sidecarPaths)
      const stored = await this.port.mockQueueStore.load(this.port.sidecarPaths)
      this.port.mockTasks = stored ?? [...MOCK_TASKS]
      this.port.config = await this.port.sidecarStore.loadConfig(this.port.sidecarPaths)
      let globalUiPreferences: GlobalUiPreferences = {
        theme: this.port.config.ui.theme,
        counterPackEnabled: this.port.config.ui.counterPackEnabled,
        language: this.port.config.ui.language,
      }
      try {
        globalUiPreferences =
          await this.port.workspaceSessionStore.initializeGlobalUiPreferences(globalUiPreferences)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('[workspace-runtime] failed to initialize global ui preferences:', message)
      }
      this.port.config = applyGlobalUiPreferences(this.port.config, globalUiPreferences)
      const loadedUiState = await this.port.sidecarStore.loadUiState(this.port.sidecarPaths)
      // Default to no task selected on workspace open: the task list opens with the
      // Add task composer in focus rather than a restored detail view. An empty string
      // marks the selection as explicitly cleared so the projection won't auto-pick one.
      this.port.uiState = { ...loadedUiState, selectedTaskId: '' }
      this.port.integrationsService.hydrateFromConfig(this.port.config)
      this.port.integrationsService.setOnChange(() => {
        void this.port.refreshAndNotify()
      })
      if (this.port.config.integrations?.hookServer.enabled) {
        try {
          const restored = await this.port.integrationsService.toggleHookServer(
            this.port.sidecarPaths,
            this.port.config,
            {
              enabled: true,
              port: this.port.config.integrations.hookServer.port,
            },
          )
          this.port.config = restored.config
        } catch (error: unknown) {
          if (error instanceof HookServerStartError && error.code === 'EADDRINUSE') {
            this.port.config = error.configAfterRollback
            const devRecovery = process.env.NODE_ENV_ELECTRON_VITE === 'development'
            console.warn(
              devRecovery
                ? `[workspace-runtime] hook server port ${error.port} busy; disabled in config (dev recovery)`
                : `[workspace-runtime] hook server port ${error.port} busy; disabled in config`,
            )
          } else {
            throw error
          }
        }
      }
      this.port.connection = await checkTaktCli(this.port.config)
      const routingCatalogStore = new WorkflowRoutingCatalogStore(workspacePath)
      this.port.workflowRoutingCatalogStore = routingCatalogStore
      this.port.canonicalWorkflowManager = new PlanetzWorkflowCanonicalManager(
        workspacePath,
        this.port.config,
        this.port.sidecarPaths,
        this.port.isolatedTaktWorkspace.isolatedRepoPath,
        routingCatalogStore,
      )
      await ensureCanonicalScaffold(this.port.sidecarPaths, workspacePath)
      await this.upgradeInstalledSpecDrivenWorkflowIfNeeded()
      await migrateLegacyMainTaktFacetsToOrbitIfNeeded(workspacePath, this.port.config)
      const isolatedRepoPath = this.env.requireIsolatedRepoPath()
      await this.maybeNormalizeTasksForDirectExecution(isolatedRepoPath)
      await this.bootstrapProductDefaultWorkflow(workspacePath)
      await this.cleanupLeakedInternalWorkflowFilesIfNeeded()
      await this.bootstrapWorkflowRoutingCatalog(workspacePath)
      await this.migrateImplicitLibraryWorkflowsIfNeeded()
      await this.refreshCanonicalImportOffer(workspacePath, isolatedRepoPath)
      this.port.invalidateWorkflowRoutingCaches()
      const executionProfile = this.env.buildExecutionProfileContext()
      this.port.connector = new TaktConnectorCli(
        isolatedRepoPath,
        this.port.config,
        executionProfile,
      )
      this.port.watchManager = new WatchManager(isolatedRepoPath, this.port.config)
      await this.watch.syncRuntimeWatchers()
      await this.port.rebuildSddOpenSnapshot()
      const state = await this.port.refreshState()
      await this.gcOrphanRuntimeWorkflowsIfNeeded(state.tasks)
      this.port.ollamaHealthMonitor.start(() => this.port.loadEffectiveEngineConfig())
      await this.port.workspaceSessionStore.markOpened(workspacePath).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('[app-session] failed to mark recent workspace:', message)
      })
      return state
    } catch (error) {
      await this.teardownWorkspaceRuntimeInternal()
      throw error
    }
  }

  private async maybeNormalizeTasksForDirectExecution(isolatedRepoPath: string): Promise<void> {
    if (this.port.mockQueueEnabled()) return
    if (!isPendingDirectMigrationEnabled()) return
    const migration = await migrateTasksToDirectExecutionIfNeeded(
      isolatedRepoPath,
      this.port.requireConfig(),
    )
    if (!migration.changed) return
    console.info('[workspace-runtime] normalized pending tasks for direct execution', {
      migratedCount: migration.migratedCount,
      isolatedRepoPath,
    })
  }

  private async bootstrapWorkflowRoutingCatalog(_workspacePath: string): Promise<void> {
    const manager = this.port.canonicalWorkflowManager
    const store = this.port.workflowRoutingCatalogStore
    if (!manager || !store) return
    const workflows = await manager.list()
    const seeded = await ensureWorkflowRoutingCatalogSeeded(store, workflows)
    const merged = await mergeNewWorkflowsIntoRoutingCatalog(store, workflows)
    const reconciled = await reconcileRoutingGroupsInCatalog(store, workflows)
    const metadataReconciled = await reconcileRoutingMetadataInCatalog(store)
    const autoReconciled = await reconcileBuiltinAutoEligibilityInCatalog(store, workflows)
    if (seeded) {
      console.info('[workspace-runtime] seeded workflow routing catalog', {
        workflowCount: workflows.length,
      })
    } else if (merged) {
      console.info('[workspace-runtime] merged new workflows into routing catalog', {
        workflowCount: workflows.length,
      })
    } else if (reconciled) {
      console.info('[workspace-runtime] reconciled workflow routing groups in catalog', {
        workflowCount: workflows.length,
      })
    } else if (metadataReconciled) {
      console.info('[workspace-runtime] reconciled workflow routing metadata in catalog', {
        workflowCount: workflows.length,
      })
    } else if (autoReconciled) {
      console.info('[workspace-runtime] reconciled builtin auto eligibility in routing catalog', {
        workflowCount: workflows.length,
      })
    }
  }

  private async gcOrphanRuntimeWorkflowsIfNeeded(tasks: AppState['tasks']): Promise<void> {
    const paths = this.port.sidecarPaths
    if (!paths) return
    try {
      const referenced = collectReferencedRuntimeWorkflowNames(tasks)
      const removed = await gcOrphanRuntimeWorkflowFiles(paths, referenced)
      if (removed > 0) {
        console.info('[workspace-runtime] removed orphan runtime workflow files', { removed })
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[workspace-runtime] failed to gc orphan runtime workflows:', message)
    }
  }

  private async migrateImplicitLibraryWorkflowsIfNeeded(): Promise<void> {
    const manager = this.port.canonicalWorkflowManager
    const paths = this.port.sidecarPaths
    const config = this.port.config
    if (!manager || !paths || !config) return

    try {
      const workflows = await manager.list()
      const promptHistory = await promptHistoryStore.list(paths, PROMPT_HISTORY_MAX_ITEMS)
      const candidates = collectImplicitWorkflowUsageCandidates({
        promptHistory,
        tasks: this.port.mockTasks,
      })
      const migrated = applyImplicitLibraryWorkflowMigration(config, workflows, candidates)
      if (!migrated.changed) return

      this.port.config = migrated.config
      await this.port.sidecarStore.saveConfig(paths, migrated.config)
      console.info('[workspace-runtime] merged implicit library workflows into ui preferences', {
        implicitCount: migrated.config.ui.workflowLibrary.implicitEnabledWorkflows.length,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[workspace-runtime] failed to migrate implicit library workflows:', message)
    }
  }

  private async upgradeInstalledSpecDrivenWorkflowIfNeeded(): Promise<void> {
    const manager = this.port.canonicalWorkflowManager
    const paths = this.port.sidecarPaths
    if (!manager || !paths) return
    try {
      const result = await upgradeInstalledSpecDrivenWorkflowIfStale(
        manager,
        paths.planetzWorkflowsDir,
      )
      if (!result?.upgraded) return
      console.info(
        '[workspace-runtime] upgraded spec-driven workflow to current installer version',
        {
          facetsWritten: result.facetsWritten,
        },
      )
      manager.invalidateListCache()
      this.port.invalidateWorkflowRoutingCaches()
      this.port.invalidateExecutionCatalogCache()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[workspace-runtime] spec-driven workflow upgrade failed:', message)
    }
  }

  private async bootstrapProductDefaultWorkflow(workspacePath: string): Promise<void> {
    const workflowBootstrap = await ensureProductBuiltinWorkflows(
      workspacePath,
      this.port.requireConfig(),
      this.port.requireSidecarPaths(),
      this.port.requireCanonicalWorkflowManager(),
    )
    if (
      workflowBootstrap.workflowsCreated <= 0 &&
      workflowBootstrap.builtinFacetsCreated <= 0 &&
      workflowBootstrap.facetsMaterialized <= 0
    )
      return
    console.info('[workspace-runtime] ensured product builtin workflows', {
      workflowsCreated: workflowBootstrap.workflowsCreated,
      builtinFacetsCreated: workflowBootstrap.builtinFacetsCreated,
      facetRefs: workflowBootstrap.facetRefs,
      facetsMaterialized: workflowBootstrap.facetsMaterialized,
      warnings: workflowBootstrap.warnings.length,
    })
  }

  private async cleanupLeakedInternalWorkflowFilesIfNeeded(): Promise<void> {
    const paths = this.port.sidecarPaths
    const manager = this.port.canonicalWorkflowManager
    if (!paths || !manager) return

    const leakedCanonicalPath = join(paths.planetzWorkflowsDir, 'ollama-chat.yaml')
    let canonicalYaml = ''
    try {
      canonicalYaml = await readFile(leakedCanonicalPath, 'utf8')
    } catch {
      return
    }

    if (canonicalYaml !== BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML) {
      return
    }

    try {
      await unlink(leakedCanonicalPath)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[workspace-runtime] failed to cleanup leaked internal workflow file:', message)
      return
    }

    manager.invalidateListCache()
    this.port.invalidateWorkflowRoutingCaches()
    this.port.invalidateExecutionCatalogCache()
    console.info('[workspace-runtime] cleaned leaked internal workflow file', {
      workflow: 'ollama-chat',
    })
  }

  private async refreshCanonicalImportOffer(
    workspacePath: string,
    isolatedRepoPath: string,
  ): Promise<void> {
    if (!this.port.mockQueueEnabled() && !this.port.uiState.canonicalImportPromptSeen) {
      this.port.canonicalImportOffer = await previewCanonicalImport(
        workspacePath,
        this.port.requireConfig(),
        this.port.requireSidecarPaths(),
        { taktRepoPath: isolatedRepoPath },
      )
      return
    }
    this.port.canonicalImportOffer = null
  }

  openRecentWorkspace(path: string): Promise<{ path: string; state: AppState }> {
    return this.runExclusiveWorkspaceTransition(async () => {
      const exists = await this.port.workspaceSessionStore.pathExists(path)
      if (!exists) {
        await this.port.workspaceSessionStore.remove(path)
        throw new Error(`Workspace not found: ${path}`)
      }
      const state = await this.openWorkspaceInternal(path)
      return { path, state }
    })
  }

  listRecentWorkspaces(): Promise<RecentWorkspace[]> {
    return this.port.workspaceSessionStore.listRecent()
  }

  async removeRecentWorkspace(path: string): Promise<RecentWorkspace[]> {
    return this.port.workspaceSessionStore.remove(path)
  }

  openLastWorkspaceIfAvailable(): Promise<{ path: string; state: AppState } | null> {
    return this.runExclusiveWorkspaceTransition(async () => {
      const path = await this.port.workspaceSessionStore.getLastOpenedPath()
      if (!path) return null
      const exists = await this.port.workspaceSessionStore.pathExists(path)
      if (!exists) {
        await this.port.workspaceSessionStore.remove(path)
        return null
      }
      const state = await this.openWorkspaceInternal(path)
      return { path, state }
    })
  }

  teardownWorkspaceRuntime(): Promise<void> {
    return this.runExclusiveWorkspaceTransition(() => this.teardownWorkspaceRuntimeInternal())
  }

  private async teardownWorkspaceRuntimeInternal(): Promise<void> {
    this.port.ollamaHealthMonitor.stop()
    await this.watch.teardownWatchResources()
    await this.port.integrationsService.dispose().catch(() => {})
    this.port.connector = null
    this.port.isolatedTaktWorkspace = null
    this.port.canonicalWorkflowManager = null
    this.port.workflowRoutingFeatureCache.invalidate()
    this.port.workflowRoutingCatalogStore = null
    this.port.cachedState = null
    this.port.invalidateSddOpenSnapshot()
    this.port.setCachedRunEvents([])
    this.port.taskCatalog.invalidate()
    this.port.chainCoordinator.reset()
    this.port.composerAssistantService.clearAll()
    this.port.resetModelHistoryTracker()
    this.port.invalidateExecutionCatalogCache()
    if (this.port.sidecarPaths) {
      closeSidecarSqlite(this.port.sidecarPaths)
    }
    this.port.workspacePath = null
    this.port.sidecarPaths = null
    this.port.config = null
    this.port.canonicalImportOffer = null
    this.port.bootstrapOverride = null
    this.port.connection = createInitialConnectionState()
    this.port.uiState = createInitialUiState()
    this.port.mockTasks = []
  }

  confirmCanonicalImport(options?: { importHomeGlobal?: boolean }): Promise<AppState> {
    return this.runExclusiveWorkspaceTransition(async () => {
      const paths = this.port.requireSidecarPaths()
      const offer = this.port.canonicalImportOffer
      if (!offer) return this.port.refreshState()
      await applyCanonicalImport(
        this.port.requireWorkspacePath(),
        this.port.requireConfig(),
        paths,
        {
          ...offer,
          importHomeGlobal: options?.importHomeGlobal === true,
        },
        { taktRepoPath: this.env.requireIsolatedRepoPath() },
      )
      this.port.canonicalImportOffer = null
      await this.port.persistUiState({ canonicalImportPromptSeen: true })
      this.port.invalidateWorkflowRoutingCaches()
      await this.watch.restartWatchIfRunning()
      return this.port.refreshState()
    })
  }

  dismissCanonicalImport(): Promise<AppState> {
    return this.runExclusiveWorkspaceTransition(async () => {
      this.port.canonicalImportOffer = null
      await this.port.persistUiState({ canonicalImportPromptSeen: true })
      const paths = this.port.sidecarPaths
      if (paths) await ensureEmptyEngineConfigIfMissing(paths)
      return this.port.refreshState()
    })
  }

  setBootstrapOverride(status: WorkspaceBootstrapStatus): Promise<AppState> {
    return this.runExclusiveWorkspaceTransition(async () => {
      this.port.bootstrapOverride = status
      await this.watch.syncRuntimeWatchers()
      return this.port.refreshState()
    })
  }

  initializeWorkspace(createTaktDir: boolean): Promise<AppState> {
    return this.runExclusiveWorkspaceTransition(async () => {
      await initializeWorkspace(
        this.port.requireWorkspacePath(),
        createTaktDir,
        this.env.requireIsolatedRepoPath(),
      )
      this.port.bootstrapOverride = null
      await this.watch.syncRuntimeWatchers()
      return this.port.refreshState()
    })
  }
}
