import {
  DEFAULT_CONFIG,
  EMPTY_WORKFLOW_LIBRARY_PREFS,
  type UiConfig,
  type UiState,
} from '@planetz/shared'
import { vi } from 'vitest'
import { WorkflowRoutingFeatureCache } from '../session/workflow-auto/routing-feature-cache.js'
import { WorkspaceOpenService } from '../session/workspace-open-service.js'
import { WorkspaceRuntimeEnvService } from '../session/workspace-runtime-env-service.js'
import type { WorkspaceRuntimePort } from '../session/workspace-runtime-port.js'
import { WorkspaceRuntimeService } from '../session/workspace-runtime-service.js'
import { WorkspaceWatchService } from '../session/workspace-watch-service.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

export const previewCanonicalImportMock = vi.fn()
export const applyCanonicalImportMock = vi.fn()
export const ensureCanonicalScaffoldMock = vi.fn()
export const ensureEmptyEngineConfigIfMissingMock = vi.fn()
export const resolveSidecarPathsMock = vi.fn()
export const checkTaktCliMock = vi.fn()
export const sanitizeTasksYamlForTaktMock = vi.fn()
export const readTaskRunEventSourcesMock = vi.fn()
export const startRunsWatcherMock = vi.fn()
export const watchStartMock = vi.fn()
export const watchStopMock = vi.fn()
export const watchSyncConnectionMock = vi.fn()
export const openSidecarSqliteMock = vi.fn()
export const closeSidecarSqliteMock = vi.fn()
export const migratePendingTasksToDirectExecutionIfNeededMock = vi.fn()
export const ensureProductBuiltinWorkflowsMock = vi.fn()
/** @deprecated Use {@link ensureProductBuiltinWorkflowsMock}. */
export const ensureProductDefaultWorkflowMock = ensureProductBuiltinWorkflowsMock

export function configForTest(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
    watch: { autoStart: false },
    ui: {
      ...DEFAULT_CONFIG.ui,
      workflowLibrary: { ...EMPTY_WORKFLOW_LIBRARY_PREFS },
      pinnedWorkflows: [],
      hiddenCoreWorkflows: [],
    },
  }
}

export function uiGlobalForTest() {
  return {
    theme: 'default' as const,
    counterPackEnabled: false,
    language: 'en' as const,
  }
}

export function createWorkspaceRuntimePort(initialUiState: UiState = {}): WorkspaceRuntimePort {
  const paths = mockSidecarPaths('/tmp/ws/.orbit')
  const workflowRoutingFeatureCache = new WorkflowRoutingFeatureCache()
  const port = {
    workspacePath: null,
    isolatedTaktWorkspace: null,
    sidecarPaths: null,
    config: null,
    uiState: initialUiState,
    connection: { cli: 'unknown', watch: 'unknown' },
    mockTasks: [],
    bootstrapOverride: null,
    canonicalImportOffer: null,
    cachedState: null,
    setCachedRunEvents: vi.fn(),
    stopRunsWatcher: null,
    connector: null,
    watchManager: null,
    canonicalWorkflowManager: null,
    workflowRoutingCatalogStore: null,
    workflowRoutingFeatureCache,
    integrationsService: {
      hydrateFromConfig: vi.fn(),
      setOnChange: vi.fn(),
      toggleHookServer: vi.fn(async () => ({ config: configForTest() })),
      dispose: vi.fn(async () => {}),
    },
    sidecarStore: {
      loadConfig: vi.fn(async () => configForTest()),
      loadUiState: vi.fn(async () => initialUiState),
    },
    mockQueueStore: {
      load: vi.fn(async () => null),
    },
    engineConfigStore: {
      load: vi.fn(async () => ({})),
    },
    agentOverridesStore: {
      load: vi.fn(async () => ({})),
    },
    workspaceSessionStore: {
      markOpened: vi.fn(async () => {}),
      pathExists: vi.fn(async () => true),
      remove: vi.fn(async () => []),
      listRecent: vi.fn(async () => []),
      getLastOpenedPath: vi.fn(async () => null),
      initializeGlobalUiPreferences: vi.fn(async (initial) => initial ?? uiGlobalForTest()),
    },
    taskCatalog: {
      invalidate: vi.fn(),
    },
    chainCoordinator: {
      reset: vi.fn(),
    },
    composerAssistantService: {
      clearAll: vi.fn(),
    },
    ollamaHealthMonitor: {
      start: vi.fn(),
      stop: vi.fn(),
      getSnapshot: vi.fn(() => null),
      poll: vi.fn(async () => null),
    },
    loadEffectiveEngineConfig: vi.fn(async () => ({ provider: 'cursor', model: 'auto' })),
    mockQueueEnabled: () => false,
    refreshState: vi.fn(async () => ({ workspace: { path: '/tmp/ws' } })),
    refreshAndNotify: vi.fn(async () => {}),
    persistUiState: vi.fn(async (patch: Partial<UiState>) => {
      port.uiState = { ...port.uiState, ...patch }
    }),
    requireSidecarPaths: () => {
      if (!port.sidecarPaths) throw new Error('No sidecar paths')
      return port.sidecarPaths
    },
    requireWorkspacePath: () => {
      if (!port.workspacePath) throw new Error('No workspace path')
      return port.workspacePath
    },
    requireConfig: () => {
      if (!port.config) throw new Error('No config')
      return port.config
    },
    requireCanonicalWorkflowManager: () => {
      if (!port.canonicalWorkflowManager) throw new Error('No workflow manager')
      return port.canonicalWorkflowManager
    },
    resetModelHistoryTracker: vi.fn(),
    invalidateExecutionCatalogCache: vi.fn(),
    invalidateWorkflowRoutingCaches: vi.fn(() => {
      port.canonicalWorkflowManager?.invalidateListCache?.()
      workflowRoutingFeatureCache.invalidate()
    }),
    clearKiroSpecsCache: vi.fn(),
    rebuildSddOpenSnapshot: vi.fn(async () => null),
    invalidateSddOpenSnapshot: vi.fn(),
  } as unknown as WorkspaceRuntimePort

  resolveSidecarPathsMock.mockResolvedValue(paths)
  checkTaktCliMock.mockResolvedValue({ cli: 'ok', watch: 'unknown' })
  ensureCanonicalScaffoldMock.mockResolvedValue(undefined)
  migratePendingTasksToDirectExecutionIfNeededMock.mockResolvedValue({
    changed: false,
    migratedCount: 0,
  })
  ensureProductBuiltinWorkflowsMock.mockResolvedValue({
    workflowsCreated: 0,
    builtinFacetsCreated: 0,
    facetRefs: 0,
    facetsMaterialized: 0,
    warnings: [],
  })
  watchSyncConnectionMock.mockResolvedValue('stopped')
  watchStartMock.mockResolvedValue('running')
  watchStopMock.mockResolvedValue('stopped')
  openSidecarSqliteMock.mockResolvedValue(undefined)
  startRunsWatcherMock.mockReturnValue(() => {})
  sanitizeTasksYamlForTaktMock.mockResolvedValue(undefined)
  readTaskRunEventSourcesMock.mockResolvedValue({
    runDirSlugToTaskId: new Map(),
    additionalRunRoots: ['/tmp/custom-worktree/.takt/runs'],
  })

  return port
}

/** Same wiring as {@link WorkspaceRuntimeService} for service-level unit tests. */
export function createWorkspaceRuntimeStack(initialUiState: UiState = {}) {
  const port = createWorkspaceRuntimePort(initialUiState)
  const env = new WorkspaceRuntimeEnvService(port)
  const watch = new WorkspaceWatchService(port, env)
  const open = new WorkspaceOpenService(port, env, watch)
  const facade = new WorkspaceRuntimeService(port)
  return { port, env, watch, open, facade }
}
