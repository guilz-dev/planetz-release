import { describe, expect, it, vi } from 'vitest'
import { MOCK_TASKS } from '../mock/mock-data.js'
import {
  StateRefreshCoordinator,
  type StateRefreshPort,
} from '../session/state-refresh-coordinator.js'

describe('StateRefreshCoordinator', () => {
  it('projects mock state when mockQueueEnabled is true', async () => {
    const invalidate = vi.fn()
    const setCachedRunEvents = vi.fn()
    const getSddOpenSnapshot = vi.fn(async () => null)
    const port = {
      workspacePath: '/tmp/ws',
      sidecarPaths: { root: '/tmp/ws/.orbit', isWorkspaceLocal: true },
      config: {},
      uiState: {},
      connection: { cli: 'ok', watch: 'stopped' },
      mockTasks: [...MOCK_TASKS],
      bootstrapOverride: null,
      canonicalImportOffer: null,
      cachedState: null,
      taskCatalog: { invalidate, loadCached: vi.fn(), idSet: vi.fn() },
      chainCoordinator: { reconcileAndPersist: vi.fn(async () => []) },
      integrationsService: {
        getState: vi.fn(() => ({})),
        buildIntegrationAgentTemplates: vi.fn(() => []),
        applyAgentOverlays: vi.fn((agents: unknown) => agents),
      },
      mockQueueEnabled: () => true,
      workflowManager: { list: vi.fn(async () => []) },
      persistUiState: vi.fn(async () => {}),
      onTasksUpdatedForModelHistory: vi.fn(async () => {}),
      loadProjectionContext: vi.fn(async () => ({
        engine: {},
        agentOverrides: {},
        pendingProfilesByTaskId: new Map(),
      })),
      pendingRunNowAttribution: null,
      setPendingRunNowAttribution: vi.fn(),
      trackTaskExecutionProfile: vi.fn(),
      setCachedRunEvents,
      getSddOpenSnapshot,
      taskPrLinkStore: { list: vi.fn(async () => []) },
    } as unknown as StateRefreshPort

    const coordinator = new StateRefreshCoordinator(port)
    const state = await coordinator.refreshState()

    expect(state.workspace.path).toBe('/tmp/ws')
    expect(state.mockQueueEnabled).toBe(true)
    expect(state.tasks.length).toBeGreaterThan(0)
    expect(invalidate).toHaveBeenCalled()
    expect(setCachedRunEvents).toHaveBeenCalled()
    expect(setCachedRunEvents.mock.calls[0]?.[0]?.length).toBeGreaterThan(0)
    expect(getSddOpenSnapshot).toHaveBeenCalledTimes(1)
  })

  it('uses getSddOpenSnapshot on consecutive refreshes without rebuild', async () => {
    const snapshot = {
      intentLedgerPendingCount: 0,
      intentLedgerUnanchoredCount: 0,
      kiroSpecCount: 0,
      featuresNeedingApproval: [],
      recommendedEntry: 'dashboard' as const,
    }
    const getSddOpenSnapshot = vi.fn(async () => snapshot)
    const port = {
      workspacePath: '/tmp/ws',
      sidecarPaths: { root: '/tmp/ws/.orbit', isWorkspaceLocal: true },
      config: {},
      uiState: {},
      connection: { cli: 'ok', watch: 'stopped' },
      mockTasks: [...MOCK_TASKS],
      bootstrapOverride: null,
      canonicalImportOffer: null,
      cachedState: null,
      taskCatalog: {
        invalidate: vi.fn(),
        loadCached: vi.fn(),
        idSet: vi.fn(() => new Set()),
      },
      chainCoordinator: { reconcileAndPersist: vi.fn(async () => []) },
      integrationsService: {
        getState: vi.fn(() => ({})),
        buildIntegrationAgentTemplates: vi.fn(() => []),
        applyAgentOverlays: vi.fn((agents: unknown) => agents),
      },
      mockQueueEnabled: () => true,
      workflowManager: { list: vi.fn(async () => []) },
      persistUiState: vi.fn(async () => {}),
      onTasksUpdatedForModelHistory: vi.fn(async () => {}),
      loadProjectionContext: vi.fn(async () => ({
        engine: {},
        agentOverrides: {},
        pendingProfilesByTaskId: new Map(),
      })),
      pendingRunNowAttribution: null,
      setPendingRunNowAttribution: vi.fn(),
      trackTaskExecutionProfile: vi.fn(),
      setCachedRunEvents: vi.fn(),
      getSddOpenSnapshot,
      taskPrLinkStore: { list: vi.fn(async () => []) },
    } as unknown as StateRefreshPort

    const coordinator = new StateRefreshCoordinator(port)
    await coordinator.refreshState()
    await coordinator.refreshState()

    expect(getSddOpenSnapshot).toHaveBeenCalledTimes(2)
    expect(getSddOpenSnapshot).not.toHaveBeenCalledWith(expect.anything(), 'rebuild')
  })
})
