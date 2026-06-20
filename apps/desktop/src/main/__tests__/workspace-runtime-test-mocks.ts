import { vi } from 'vitest'
import {
  applyCanonicalImportMock,
  checkTaktCliMock,
  closeSidecarSqliteMock,
  ensureCanonicalScaffoldMock,
  ensureEmptyEngineConfigIfMissingMock,
  ensureProductBuiltinWorkflowsMock,
  migratePendingTasksToDirectExecutionIfNeededMock,
  openSidecarSqliteMock,
  previewCanonicalImportMock,
  readTaskRunEventSourcesMock,
  resolveSidecarPathsMock,
  sanitizeTasksYamlForTaktMock,
  startRunsWatcherMock,
  watchStartMock,
  watchStopMock,
  watchSyncConnectionMock,
} from './workspace-runtime-test-port.js'

vi.mock('../planetz/canonical-bootstrap.js', () => ({
  previewCanonicalImport: (...args: unknown[]) => previewCanonicalImportMock(...args),
  applyCanonicalImport: (...args: unknown[]) => applyCanonicalImportMock(...args),
  ensureCanonicalScaffold: (...args: unknown[]) => ensureCanonicalScaffoldMock(...args),
  ensureEmptyEngineConfigIfMissing: (...args: unknown[]) =>
    ensureEmptyEngineConfigIfMissingMock(...args),
}))

vi.mock('../sidecar/sidecar-store.js', () => ({
  resolveSidecarPaths: (...args: unknown[]) => resolveSidecarPathsMock(...args),
  SidecarStore: class {},
}))

vi.mock('../takt/connection-check.js', () => ({
  checkTaktCli: (...args: unknown[]) => checkTaktCliMock(...args),
}))

vi.mock('../lib/tasks-yaml-takt-compat.js', () => ({
  sanitizeTasksYamlForTakt: (...args: unknown[]) => sanitizeTasksYamlForTaktMock(...args),
}))

vi.mock('../lib/tasks-yaml-reader.js', () => ({
  readTaskRunEventSources: (...args: unknown[]) => readTaskRunEventSourcesMock(...args),
}))

vi.mock('../lib/runs-watcher.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/runs-watcher.js')>()
  return {
    ...actual,
    startRunsWatcher: (...args: unknown[]) => startRunsWatcherMock(...args),
  }
})

vi.mock('../storage/sqlite/connection.js', () => ({
  openSidecarSqlite: (...args: unknown[]) => openSidecarSqliteMock(...args),
  closeSidecarSqlite: (...args: unknown[]) => closeSidecarSqliteMock(...args),
}))

vi.mock('../takt/watch-manager.js', () => ({
  WatchManager: class {
    start = (...args: unknown[]) => watchStartMock(...args)
    stop = (...args: unknown[]) => watchStopMock(...args)
    syncConnection = (...args: unknown[]) => watchSyncConnectionMock(...args)
  },
}))

vi.mock('../takt/connector-cli.js', () => ({
  TaktConnectorCli: class {},
}))

vi.mock('../planetz/workflow-canonical-manager.js', () => ({
  PlanetzWorkflowCanonicalManager: class {
    invalidateListCache() {}
    async list() {
      return []
    }
  },
}))

vi.mock('../planetz/takt-runtime-adapter.js', () => ({
  buildTaktRuntimeEnv: vi.fn(async () => ({})),
  resolveRuntimeWorkflow: vi.fn(async () => undefined),
  watchCliOverridesFromEngine: vi.fn(() => ({})),
}))

vi.mock('../lib/workspace-init.js', () => ({
  initializeWorkspace: vi.fn(async () => {}),
}))

vi.mock('../planetz/isolated-takt-workspace.js', () => ({
  ensureIsolatedTaktWorkspace: vi.fn(async (mainWorkspacePath: string) => ({
    mainWorkspacePath,
    isolatedRepoPath: `${mainWorkspacePath}/.isolated-repo`,
    lastBaseRef: null,
  })),
  prepareIsolatedTaktExecution: vi.fn(),
}))

vi.mock('../planetz/effective-engine-config.js', () => ({
  loadEffectiveEngineConfig: vi.fn(async () => ({})),
}))

vi.mock('../lib/workflow-draft-store.js', () => ({
  rescueLegacyHomeDraftsIfNeeded: vi.fn(async () => {}),
}))

vi.mock('../planetz/orbit-facets-migrate.js', () => ({
  migrateLegacyMainTaktFacetsToOrbitIfNeeded: vi.fn(async () => false),
}))

vi.mock('../lib/migrate-tasks-direct-execution.js', () => ({
  migrateTasksToDirectExecutionIfNeeded: (...args: unknown[]) =>
    migratePendingTasksToDirectExecutionIfNeededMock(...args),
  migratePendingTasksToDirectExecutionIfNeeded: (...args: unknown[]) =>
    migratePendingTasksToDirectExecutionIfNeededMock(...args),
}))

vi.mock('../planetz/default-workflow-bootstrap.js', () => ({
  ensureProductBuiltinWorkflows: (...args: unknown[]) => ensureProductBuiltinWorkflowsMock(...args),
  ensureProductDefaultWorkflow: (...args: unknown[]) => ensureProductBuiltinWorkflowsMock(...args),
}))
