import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppState, UiState } from '@planetz/shared'
import { DEFAULT_CONFIG, ROUTING_GROUPS } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type TaskCommandPort, TaskCommandService } from '../session/task-command-service.js'
import { WorkflowRoutingFeatureCache } from '../session/workflow-auto/routing-feature-cache.js'
import { ConversationStore } from '../sidecar/conversation-store.js'
import { MockQueueStore } from '../sidecar/mock-queue-store.js'
import { UI_STATE_KV_KEY } from '../sidecar/sidecar-kv-keys.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { SidecarStore } from '../sidecar/sidecar-store.js'
import { closeAllSidecarSqlite, getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson } from '../storage/sqlite/kv-store.js'
import { listConversationsForTask } from '../storage/sqlite/repositories/conversation-repository.js'
import { countMockTasks } from '../storage/sqlite/repositories/mock-tasks-repository.js'
import { listPromptHistory } from '../storage/sqlite/repositories/prompt-history-repository.js'
import { listRetryContexts } from '../storage/sqlite/repositories/retry-context-repository.js'
import * as sidecarWriteScope from '../storage/sqlite/sidecar-write-scope.js'
import type { TaktConnectorCli } from '../takt/connector-cli.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

function createSqliteTaskCommandPort(
  paths: SidecarPaths,
  overrides: Partial<TaskCommandPort> = {},
): TaskCommandPort {
  let uiState: UiState = {}
  let mockTasks: TaskCommandPort['mockTasks'] = []
  const syncUiState = vi.fn((state: UiState) => {
    uiState = state
  })
  const persistUiState = vi.fn(async (patch: Partial<UiState>) => {
    uiState = { ...uiState, ...patch }
  })

  const connector = {
    enqueueTask: vi.fn(async () => ({ taskId: 'queued-prod', taskDir: '' })),
  } as unknown as TaktConnectorCli

  return {
    workspacePath: '/tmp/planetz-sqlite-tx',
    sidecarPaths: paths,
    config: DEFAULT_CONFIG,
    get uiState() {
      return uiState
    },
    connection: { cli: 'ok', watch: 'stopped' },
    get mockTasks() {
      return mockTasks
    },
    set mockTasks(value) {
      mockTasks = value
    },
    connector,
    readTaktTasksFresh: vi.fn(async () => []),
    readTaktTasksFreshAt: vi.fn(async () => []),
    invalidateTaktTaskYamlCache: vi.fn(),
    taktTaskIdSet: (tasks) => new Set(tasks.map((t) => t.id)),
    mockQueueStore: new MockQueueStore(),
    conversationStore: new ConversationStore(),
    promptHistoryStore: {} as TaskCommandPort['promptHistoryStore'],
    retryContextStore: {} as TaskCommandPort['retryContextStore'],
    resolveExecutionProfileForInput: vi.fn(async () => ({ provider: 'cursor', model: 'auto' })),
    loadEffectiveEngineConfig: vi.fn(async () => ({ provider: 'cursor', model: 'auto' })),
    trackTaskExecutionProfile: vi.fn(),
    recordExecutionSuccess: vi.fn(async () => {}),
    mockQueueEnabled: () => true,
    refreshState: vi.fn(async () => ({}) as AppState),
    syncUiState,
    persistUiState,
    requireSidecarPaths: () => paths,
    requireWorkspacePath: () => '/tmp/planetz-sqlite-tx',
    requireTaktRepoPath: () => '/tmp/planetz-isolated',
    requireConfig: () => DEFAULT_CONFIG,
    setPendingRunNowAttribution: vi.fn(),
    syncWatchConnection: vi.fn(async () => {}),
    listAvailableWorkflowNames: vi.fn(async () => ['default']),
    listWorkflowSummaries: vi.fn(async () => [{ name: 'default', source: 'builtin' as const }]),
    loadWorkflowRoutingCatalog: vi.fn(async () => ({
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [{ name: 'default', enabledForAuto: true, routingGroups: ['general'] }],
    })),
    readWorkflowYaml: vi.fn(async () => null),
    workflowRoutingFeatureCache: new WorkflowRoutingFeatureCache(),
    regenerateEstablishedDecisionsForTask: vi.fn(async () => []),
    regenerateDecidedIntentContextForTask: vi.fn(async () => false),
    upsertTaskSupplySnapshot: vi.fn(async () => {}),
    ...overrides,
  } as TaskCommandPort
}

describe('TaskCommandService sqlite tx integration', () => {
  let dir: string
  let paths: SidecarPaths

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'task-cmd-sqlite-tx-'))
    paths = mockSidecarPaths(dir)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    closeAllSidecarSqlite()
    await rm(dir, { recursive: true, force: true })
  })

  it('mock enqueue persists all sidecar tables in one tx and syncs ui state in memory', async () => {
    const port = createSqliteTaskCommandPort(paths)
    const service = new TaskCommandService(port)

    const result = await service.enqueueTask({
      title: 'Mock task',
      body: 'Do it',
      workflow: 'default',
    })

    expect(result.taskId).toBeTruthy()
    expect(port.syncUiState).toHaveBeenCalledWith(
      expect.objectContaining({ selectedTaskId: result.taskId }),
    )
    expect(port.persistUiState).not.toHaveBeenCalled()

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(1)
    expect(listConversationsForTask(db, result.taskId)).toHaveLength(1)
    expect(listPromptHistory(db, 10)).toHaveLength(1)
    expect(readKvJson(db, UI_STATE_KV_KEY)).toEqual(
      expect.objectContaining({ selectedTaskId: result.taskId }),
    )
  })

  it('prod enqueue persists conversation, prompt, ui.state without mock_tasks', async () => {
    const sidecarStore = new SidecarStore()
    await sidecarStore.saveUiState(paths, { selectedTaskId: 'existing' })
    const port = createSqliteTaskCommandPort(paths, {
      mockQueueEnabled: () => false,
    })
    const service = new TaskCommandService(port)

    await service.enqueueTask({ title: 'Prod task', body: 'Prod body', workflow: 'default' })

    expect(port.persistUiState).not.toHaveBeenCalled()
    expect(port.syncUiState).toHaveBeenCalledWith(
      expect.objectContaining({ selectedTaskId: 'queued-prod' }),
    )

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(0)
    expect(listConversationsForTask(db, 'queued-prod')).toHaveLength(1)
    expect(listPromptHistory(db, 10)).toHaveLength(1)
  })

  it('prod derive persists conversation, retry, ui.state without mock_tasks', async () => {
    const sidecarStore = new SidecarStore()
    await sidecarStore.saveUiState(paths, { selectedTaskId: 'origin-prod' })
    const originTask = {
      id: 'origin-prod',
      title: 'Origin prod',
      body: 'origin body',
      status: 'completed' as const,
      priority: 'normal' as const,
      source: 'user' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const port = createSqliteTaskCommandPort(paths, {
      mockQueueEnabled: () => false,
      readTaktTasksFresh: vi.fn(async () => [originTask]),
      readTaktTasksFreshAt: vi.fn(async () => [originTask]),
    })
    const service = new TaskCommandService(port)

    const result = await service.retryTask('origin-prod')

    expect(result.taskId).toBe('queued-prod')
    expect(port.persistUiState).not.toHaveBeenCalled()
    expect(port.syncUiState).toHaveBeenCalledWith(
      expect.objectContaining({ selectedTaskId: 'queued-prod' }),
    )

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(0)
    expect(listConversationsForTask(db, 'queued-prod')).toHaveLength(1)
    expect(listRetryContexts(db).length).toBeGreaterThanOrEqual(1)
  })

  it('mock derive persists retry_context and does not call persistUiState', async () => {
    const port = createSqliteTaskCommandPort(paths)
    const service = new TaskCommandService(port)
    const enqueued = await service.enqueueTask({
      title: 'Origin',
      body: 'origin body',
      workflow: 'default',
    })

    await service.retryTask(enqueued.taskId)

    expect(port.persistUiState).not.toHaveBeenCalled()
    expect(port.syncUiState).toHaveBeenCalledTimes(2)

    const db = await getSidecarSqlite(paths)
    expect(listRetryContexts(db).length).toBeGreaterThanOrEqual(1)
    expect(countMockTasks(db)).toBe(2)
  })

  it('restores mockTasks memory when enqueue sidecar persist throws', async () => {
    const port = createSqliteTaskCommandPort(paths)
    vi.spyOn(sidecarWriteScope, 'persistEnqueueSidecar').mockRejectedValue(
      new Error('simulated persist failure'),
    )
    const service = new TaskCommandService(port)

    await expect(
      service.enqueueTask({ title: 'Fail', body: 'fail', workflow: 'default' }),
    ).rejects.toThrow('simulated persist failure')
    expect(port.mockTasks).toEqual([])
  })

  it('restores mockTasks memory when derive sidecar persist throws', async () => {
    const port = createSqliteTaskCommandPort(paths)
    const service = new TaskCommandService(port)
    const enqueued = await service.enqueueTask({
      title: 'Origin',
      body: 'origin body',
      workflow: 'default',
    })
    expect(port.mockTasks).toHaveLength(1)

    vi.spyOn(sidecarWriteScope, 'persistDeriveSidecar').mockRejectedValue(
      new Error('simulated derive persist failure'),
    )

    await expect(service.retryTask(enqueued.taskId)).rejects.toThrow(
      'simulated derive persist failure',
    )
    expect(port.mockTasks).toHaveLength(1)
    expect(port.mockTasks[0]?.id).toBe(enqueued.taskId)
  })

  it('does not mutate db when enqueue sidecar persist throws', async () => {
    const port = createSqliteTaskCommandPort(paths)
    const service = new TaskCommandService(port)
    await service.enqueueTask({ title: 'Seed', body: 'seed', workflow: 'default' })

    const db = await getSidecarSqlite(paths)
    const mockCountBefore = countMockTasks(db)
    const promptCountBefore = listPromptHistory(db, 10).length

    vi.spyOn(sidecarWriteScope, 'persistEnqueueSidecar').mockRejectedValue(
      new Error('simulated persist failure'),
    )

    await expect(
      service.enqueueTask({ title: 'Fail', body: 'fail', workflow: 'default' }),
    ).rejects.toThrow('simulated persist failure')

    expect(countMockTasks(db)).toBe(mockCountBefore)
    expect(listPromptHistory(db, 10)).toHaveLength(promptCountBefore)
  })

  it('keeps mockTasks in memory when persist succeeds but refreshState throws', async () => {
    const port = createSqliteTaskCommandPort(paths, {
      refreshState: vi.fn(async () => {
        throw new Error('simulated refresh failure')
      }),
    })
    const service = new TaskCommandService(port)

    await expect(
      service.enqueueTask({ title: 'Refresh fail', body: 'body', workflow: 'default' }),
    ).rejects.toThrow('simulated refresh failure')

    expect(port.mockTasks).toHaveLength(1)
    expect(port.mockTasks[0]?.title).toBe('Refresh fail')

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(1)
  })
})
