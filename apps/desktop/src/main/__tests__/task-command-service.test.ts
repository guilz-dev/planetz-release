import type {
  AppState,
  EnqueueTaskBridgeInput,
  TaskWorkflowSelectionMeta,
  UiState,
} from '@planetz/shared'
import {
  CHAT_INVESTIGATION_WORKFLOW_NAME,
  DEFAULT_CONFIG,
  OllamaExecutionBlockedError,
  ROUTING_GROUPS,
  SPEC_DRIVEN_WORKFLOW_NAME,
} from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPEC_DRIVEN_WORKFLOW_YAML } from '../../shared/spec-driven/spec-driven-workflow-yaml.js'
import * as deleteTaskPackage from '../lib/delete-task-package.js'
import * as titleGenerator from '../lib/title-generator.js'
import * as composerLlmClient from '../planetz/composer-llm-client.js'
import { TaskCatalog } from '../session/task-catalog.js'
import { type TaskCommandPort, TaskCommandService } from '../session/task-command-service.js'
import * as workflowAutoLlm from '../session/workflow-auto/llm-client.js'
import { WorkflowRoutingFeatureCache } from '../session/workflow-auto/routing-feature-cache.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import * as sidecarWriteScope from '../storage/sqlite/sidecar-write-scope.js'
import {
  BUILTIN_DEFAULT_WORKFLOW_YAML,
  BUILTIN_MINIMAL_WORKFLOW_YAML,
  BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML,
} from '../takt/builtin-workflow-yaml.js'
import type { TaktConnectorCli } from '../takt/connector-cli.js'
import { TASK_COMMAND_SETTLE_WINDOW_MS } from './test-timeouts.js'

vi.mock('../storage/sqlite/sidecar-write-scope.js', () => ({
  persistEnqueueSidecar: vi.fn(async () => {}),
  persistDeriveSidecar: vi.fn(async () => {}),
}))

vi.mock('../session/workflow-auto/workflow-yaml-resolver.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../session/workflow-auto/workflow-yaml-resolver.js')>()
  return {
    ...actual,
    createRoutingWorkflowResolver: () => {
      return async (name: string) => {
        if (name === 'default')
          return { yaml: BUILTIN_DEFAULT_WORKFLOW_YAML, source: 'builtin' as const }
        if (name === 'minimal')
          return { yaml: BUILTIN_MINIMAL_WORKFLOW_YAML, source: 'builtin' as const }
        return null
      }
    },
  }
})

function mockStructureRoutingLlm(selectedWorkflow = 'default') {
  return vi
    .spyOn(workflowAutoLlm, 'callWorkflowAutoRoutingLlmJson')
    .mockImplementation(async (input) => {
      if (String(input.systemPrompt).includes('structured task routing requirements')) {
        return input.parse(
          JSON.stringify({
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'low',
            blockingUnknowns: [],
          }),
        )
      }
      return input.parse(
        JSON.stringify({
          selectedWorkflow,
          confidence: 'high',
          decisionReason: 'structure match',
          comparedDifferences: [],
        }),
      )
    })
}

const MAIN_WORKSPACE = '/tmp/planetz-main-workspace'
const ISOLATED_REPO = '/tmp/planetz-isolated-repo'

function mockSpecDrivenWorkflowYaml(port: TaskCommandPort) {
  return vi
    .spyOn(port, 'readWorkflowYaml')
    .mockImplementation(async (name) =>
      name === SPEC_DRIVEN_WORKFLOW_NAME ? SPEC_DRIVEN_WORKFLOW_YAML : null,
    )
}

function minimalSidecarPaths(): SidecarPaths {
  return {
    root: `${MAIN_WORKSPACE}/.orbit`,
    isWorkspaceLocal: true,
    planetzWorkflowsDir: `${MAIN_WORKSPACE}/.orbit/workflows`,
  } as SidecarPaths
}

function createPort(overrides: Partial<TaskCommandPort> = {}): TaskCommandPort {
  const taskCatalog = new TaskCatalog()
  const connector = {
    enqueueTask: vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' })),
  } as unknown as TaktConnectorCli
  const readTaktTasksFresh = vi.fn(() => taskCatalog.readFresh(ISOLATED_REPO, DEFAULT_CONFIG))
  const readTaktTasksFreshAt = vi.fn((taktRepoPath: string) =>
    taskCatalog.readFresh(taktRepoPath, DEFAULT_CONFIG),
  )

  return {
    workspacePath: MAIN_WORKSPACE,
    sidecarPaths: minimalSidecarPaths(),
    config: DEFAULT_CONFIG,
    uiState: {} as UiState,
    connection: { cli: 'ok', watch: 'stopped' },
    mockTasks: [],
    connector,
    readTaktTasksFresh,
    readTaktTasksFreshAt,
    invalidateTaktTaskYamlCache: () => taskCatalog.invalidate(),
    taktTaskIdSet: (tasks) => taskCatalog.idSet(tasks),
    mockQueueStore: { save: vi.fn(async () => {}) } as unknown as TaskCommandPort['mockQueueStore'],
    conversationStore: {
      append: vi.fn(async () => {}),
    } as unknown as TaskCommandPort['conversationStore'],
    promptHistoryStore: {
      appendSubmitted: vi.fn(async () => {}),
    } as unknown as TaskCommandPort['promptHistoryStore'],
    retryContextStore: {} as unknown as TaskCommandPort['retryContextStore'],
    resolveExecutionProfileForInput: vi.fn(async () => ({ provider: 'cursor', model: 'auto' })),
    loadEffectiveEngineConfig: vi.fn(async () => ({ provider: 'cursor', model: 'auto' })),
    trackTaskExecutionProfile: vi.fn(),
    recordExecutionSuccess: vi.fn(async () => {}),
    mockQueueEnabled: () => false,
    refreshState: vi.fn(async () => ({}) as AppState),
    syncUiState: vi.fn(),
    persistUiState: vi.fn(async () => {}),
    requireSidecarPaths: () => minimalSidecarPaths(),
    requireWorkspacePath: () => MAIN_WORKSPACE,
    requireTaktRepoPath: () => ISOLATED_REPO,
    requireConfig: () => DEFAULT_CONFIG,
    setPendingRunNowAttribution: vi.fn(),
    syncWatchConnection: vi.fn(async () => {}),
    listAvailableWorkflowNames: vi.fn(async () => ['default', 'minimal']),
    listWorkflowSummaries: vi.fn(async () => [
      { name: 'default', source: 'builtin' as const },
      { name: 'minimal', source: 'builtin' as const },
    ]),
    readWorkflowYaml: vi.fn(async () => null),
    readWorkflowDocument: vi.fn(async (_name) => ({
      yaml: '',
      source: 'project' as const,
    })),
    loadWorkflowRoutingCatalog: vi.fn(async () => ({
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'default',
          enabledForAuto: true,
          routingGroups: ['general' as const],
        },
        {
          name: 'minimal',
          enabledForAuto: true,
          routingGroups: ['general' as const],
        },
      ],
    })),
    workflowRoutingFeatureCache: new WorkflowRoutingFeatureCache(),
    regenerateEstablishedDecisionsForTask: vi.fn(async () => []),
    regenerateDecidedIntentContextForTask: vi.fn(async () => false),
    upsertTaskSupplySnapshot: vi.fn(async () => {}),
    resolveKiroRoutingContext: vi.fn(async () => null),
    ...overrides,
  }
}

describe('TaskCommandService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not regenerate established-decisions facet on connector enqueue', async () => {
    const port = createPort()
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)
    await service.enqueueTask({ title: 'Task', body: 'Body', workflow: 'default' })
    expect(port.regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
  })

  it('does not regenerate established-decisions facet in mock queue enqueue', async () => {
    const port = createPort({ mockQueueEnabled: () => true, connector: null })
    const service = new TaskCommandService(port)
    await service.enqueueTask({ title: 'Mock task', body: 'Body' })
    expect(port.regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
  })

  it('does not regenerate established-decisions facet when deriving a mock task', async () => {
    const now = new Date().toISOString()
    const port = createPort({
      mockQueueEnabled: () => true,
      connector: null,
      mockTasks: [
        {
          id: 'mock-origin',
          title: 'Origin task',
          body: 'Origin body',
          priority: 'normal',
          status: 'failed',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
    })
    const service = new TaskCommandService(port)
    await service.retryTask('mock-origin')
    expect(port.regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
  })

  it('allows retry and resume derivation from terminal interrupted or aborted tasks', async () => {
    const now = new Date().toISOString()
    const port = createPort({
      mockQueueEnabled: () => true,
      connector: null,
      mockTasks: [
        {
          id: 'interrupted-origin',
          title: 'Interrupted origin',
          body: 'Recover from interruption',
          priority: 'normal',
          status: 'failed',
          statusReason: 'interrupted',
          rawStatus: 'interrupted',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'aborted-origin',
          title: 'Aborted origin',
          body: 'Continue after abort',
          priority: 'normal',
          status: 'failed',
          statusReason: 'workflow_aborted',
          rawStatus: 'aborted',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
    })
    const service = new TaskCommandService(port)

    const retry = await service.retryTask('interrupted-origin')
    const resume = await service.resumeTask('aborted-origin', 'Resume after manual inspection')

    expect(retry.taskId).not.toBe('interrupted-origin')
    expect(resume.taskId).not.toBe('aborted-origin')
    expect(port.mockTasks[0]?.id).toBe(resume.taskId)
    expect(port.mockTasks[0]?.status).toBe('pending')
    expect(
      port.mockTasks.some((task) => task.id === retry.taskId && task.status === 'pending'),
    ).toBe(true)
  })

  it('resolves missing title via orbit provider before enqueueing', async () => {
    vi.spyOn(composerLlmClient, 'callOrbitProviderRaw').mockResolvedValue('Flaky CI triage')
    const port = createPort()
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const resolveSpy = vi.spyOn(titleGenerator, 'resolveEnqueueInput')
    const service = new TaskCommandService(port)

    await service.enqueueTask({
      body: 'Investigate flaky tests in CI',
      workflow: 'default',
      issueRef: 'guilz-dev/planetz#368',
      issueNumber: 368,
    })

    expect(resolveSpy).toHaveBeenCalledWith(
      {
        body: 'Investigate flaky tests in CI',
        workflow: 'default',
        issueRef: 'guilz-dev/planetz#368',
        issueNumber: 368,
      },
      {
        provider: 'cursor',
        model: 'auto',
        cwd: ISOLATED_REPO,
        engineConfig: { provider: 'cursor', model: 'auto' },
      },
    )
    expect(port.connector?.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Flaky CI triage',
        body: 'Investigate flaky tests in CI',
        issueRef: 'guilz-dev/planetz#368',
        issueNumber: 368,
      }),
      expect.any(Set),
    )
  })

  it('falls back to first line when orbit title generation fails', async () => {
    vi.spyOn(composerLlmClient, 'callOrbitProviderRaw').mockRejectedValue(
      new Error('provider down'),
    )
    const port = createPort()
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    await service.enqueueTask({ body: 'Investigate flaky tests in CI', workflow: 'default' })

    expect(port.connector?.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Investigate flaky tests in CI',
        body: 'Investigate flaky tests in CI',
      }),
      expect.any(Set),
    )
  })

  it('loads existing task ids from requireTaktRepoPath when enqueueing via connector', async () => {
    const port = createPort()
    const loadSpy = vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([
      {
        id: 'iso-existing',
        title: 'iso-existing',
        priority: 'normal',
        status: 'pending',
        source: 'takt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    const service = new TaskCommandService(port)
    const input: EnqueueTaskBridgeInput = {
      title: 'New task',
      body: 'Do something',
    }

    await service.enqueueTask(input)

    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(port.connector?.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New task', body: 'Do something' }),
      new Set(['iso-existing']),
    )
  })

  it('enqueues a tracked task and dispatches background run when watch is stopped', async () => {
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({ connector })
    const service = new TaskCommandService(port)
    await service.runTaskNow({ title: 'Run', body: 'body', workflow: 'default' }, connector)

    expect(connector.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Run',
        body: 'body',
      }),
      expect.any(Set),
    )
    expect(connector.runTaskNow).toHaveBeenCalled()
    expect(port.regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
    expect(port.upsertTaskSupplySnapshot).toHaveBeenCalledWith('queued-1', [])
  })

  it('regenerates established-decisions facet before runTaskNow dispatch for spec-driven', async () => {
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({ connector })
    mockSpecDrivenWorkflowYaml(port)
    const service = new TaskCommandService(port)
    await service.runTaskNow(
      { title: 'Run', body: 'body', workflow: SPEC_DRIVEN_WORKFLOW_NAME },
      connector,
    )

    expect(port.regenerateEstablishedDecisionsForTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Run',
        body: 'body',
        workflow: SPEC_DRIVEN_WORKFLOW_NAME,
      }),
    )
    expect(connector.runTaskNow).toHaveBeenCalled()
  })

  it('does not dispatch connector run when watch is already running', async () => {
    vi.useFakeTimers()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' })),
      runTaskNow: vi.fn(async () => {
        throw new Error('spawn failed')
      }),
    } as unknown as TaktConnectorCli
    const port = createPort({
      connector,
      connection: { cli: 'ok', watch: 'running' },
    })
    const service = new TaskCommandService(port)

    await service.runTaskNow({ title: 'Run', body: 'body', workflow: 'default' }, connector)
    expect(connector.runTaskNow).not.toHaveBeenCalled()
    vi.clearAllTimers()
  })

  it('dispatches fallback run when watch path leaves task pending', async () => {
    vi.useFakeTimers()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({
      connector,
      connection: { cli: 'ok', watch: 'running' },
    })
    const pendingQueued = [
      {
        id: 'queued-1',
        title: 'queued-1',
        priority: 'normal' as const,
        status: 'pending' as const,
        source: 'takt' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValueOnce([])
    vi.spyOn(port, 'readTaktTasksFreshAt').mockResolvedValueOnce(pendingQueued)
    const service = new TaskCommandService(port)

    await service.runTaskNow({ title: 'Run', body: 'body', workflow: 'default' }, connector)
    expect(connector.runTaskNow).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(TASK_COMMAND_SETTLE_WINDOW_MS)
    expect(connector.runTaskNow).toHaveBeenCalledTimes(1)
    vi.clearAllTimers()
  })

  it('skips fallback run when watch has already started the task', async () => {
    vi.useFakeTimers()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({
      connector,
      connection: { cli: 'ok', watch: 'running' },
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValueOnce([])
    vi.spyOn(port, 'readTaktTasksFreshAt').mockResolvedValueOnce([
      {
        id: 'queued-1',
        title: 'queued-1',
        priority: 'normal' as const,
        status: 'running' as const,
        source: 'takt' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    const service = new TaskCommandService(port)

    await service.runTaskNow({ title: 'Run', body: 'body', workflow: 'default' }, connector)
    await vi.advanceTimersByTimeAsync(TASK_COMMAND_SETTLE_WINDOW_MS)
    expect(connector.runTaskNow).not.toHaveBeenCalled()
    vi.clearAllTimers()
  })

  it('runPendingTask: promotes pending mock task to running without enqueueing', async () => {
    const now = new Date().toISOString()
    const save = vi.fn(async () => {})
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({
      mockQueueEnabled: () => true,
      mockTasks: [
        {
          id: 'mock-1',
          title: 'pending task',
          priority: 'normal',
          status: 'pending',
          source: 'user',
          workflow: SPEC_DRIVEN_WORKFLOW_NAME,
          createdAt: now,
          updatedAt: now,
        },
      ],
      mockQueueStore: { save } as unknown as TaskCommandPort['mockQueueStore'],
      refreshState,
    })
    mockSpecDrivenWorkflowYaml(port)
    const service = new TaskCommandService(port)

    await service.runPendingTask('mock-1', port.connector ?? null)

    expect(port.regenerateEstablishedDecisionsForTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'pending task' }),
    )
    expect(port.mockTasks[0]?.status).toBe('running')
    expect(save).toHaveBeenCalledTimes(1)
    expect(refreshState).toHaveBeenCalledTimes(1)
  })

  it('runPendingTask: skips established-decisions regeneration when workflow lacks the facet', async () => {
    const now = new Date().toISOString()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'existing', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({ connector })
    vi.spyOn(port, 'readWorkflowYaml').mockResolvedValue(null)
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([
      {
        id: 'existing',
        title: 'Existing pending',
        priority: 'normal',
        status: 'pending',
        source: 'takt',
        workflow: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ])
    const service = new TaskCommandService(port)

    await service.runPendingTask('existing', connector)

    expect(port.regenerateEstablishedDecisionsForTask).not.toHaveBeenCalled()
    expect(port.upsertTaskSupplySnapshot).toHaveBeenCalledWith('existing', [])
    expect(connector.runTaskNow).toHaveBeenCalled()
  })

  it('runPendingTask: spawns takt run via connector when target is the only pending task', async () => {
    const now = new Date().toISOString()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'existing', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({ connector })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([
      {
        id: 'existing',
        title: 'Existing pending',
        priority: 'normal',
        status: 'pending',
        source: 'takt',
        workflow: SPEC_DRIVEN_WORKFLOW_NAME,
        createdAt: now,
        updatedAt: now,
      },
    ])
    mockSpecDrivenWorkflowYaml(port)
    const service = new TaskCommandService(port)

    await service.runPendingTask('existing', connector)

    expect(port.regenerateEstablishedDecisionsForTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Existing pending',
        workflow: SPEC_DRIVEN_WORKFLOW_NAME,
      }),
    )
    expect(connector.enqueueTask).not.toHaveBeenCalled()
    expect(connector.runTaskNow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Existing pending',
        workflow: SPEC_DRIVEN_WORKFLOW_NAME,
      }),
    )
  })

  it('runPendingTask: schedules watch fallback instead of immediate dispatch when watch is running', async () => {
    vi.useFakeTimers()
    const now = new Date().toISOString()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'existing', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({
      connector,
      connection: { cli: 'ok', watch: 'running' },
    })
    const solePending = [
      {
        id: 'existing',
        title: 'Existing pending',
        priority: 'normal' as const,
        status: 'pending' as const,
        source: 'takt' as const,
        workflow: SPEC_DRIVEN_WORKFLOW_NAME,
        createdAt: now,
        updatedAt: now,
      },
    ]
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValueOnce(solePending)
    vi.spyOn(port, 'readTaktTasksFreshAt').mockResolvedValueOnce(solePending)
    mockSpecDrivenWorkflowYaml(port)
    const service = new TaskCommandService(port)

    await service.runPendingTask('existing', connector)

    expect(connector.runTaskNow).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(TASK_COMMAND_SETTLE_WINDOW_MS)
    expect(connector.runTaskNow).toHaveBeenCalledTimes(1)
    expect(port.regenerateEstablishedDecisionsForTask).toHaveBeenCalledTimes(1)
    vi.clearAllTimers()
  })

  it('runPendingTask: skips watch fallback dispatch when pending queue grows before fallback', async () => {
    vi.useFakeTimers()
    const now = new Date().toISOString()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'existing', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({
      connector,
      connection: { cli: 'ok', watch: 'running' },
    })
    const solePending = [
      {
        id: 'existing',
        title: 'Existing pending',
        priority: 'normal' as const,
        status: 'pending' as const,
        source: 'takt' as const,
        workflow: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ]
    const twoPending = [
      ...solePending,
      {
        id: 'other-pending',
        title: 'Other pending',
        priority: 'normal' as const,
        status: 'pending' as const,
        source: 'takt' as const,
        workflow: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ]
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValueOnce(solePending)
    vi.spyOn(port, 'readTaktTasksFreshAt').mockResolvedValueOnce(twoPending)
    const service = new TaskCommandService(port)

    await service.runPendingTask('existing', connector)

    expect(connector.runTaskNow).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(TASK_COMMAND_SETTLE_WINDOW_MS)
    expect(connector.runTaskNow).not.toHaveBeenCalled()
    vi.clearAllTimers()
  })

  it('runPendingTask: rejects when multiple tasks are pending to avoid queue-wide run side effects', async () => {
    const now = new Date().toISOString()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'existing', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const port = createPort({ connector })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([
      {
        id: 'existing',
        title: 'Existing pending',
        priority: 'normal',
        status: 'pending',
        source: 'takt',
        workflow: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'other-pending',
        title: 'Other pending',
        priority: 'normal',
        status: 'pending',
        source: 'takt',
        workflow: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ])
    const service = new TaskCommandService(port)

    await expect(service.runPendingTask('existing', connector)).rejects.toThrow(
      /Cannot run pending task .* alone because 2 tasks are pending/,
    )
    expect(connector.runTaskNow).not.toHaveBeenCalled()
  })

  it('runPendingTask: rejects with current status when tasks.yaml is no longer pending', async () => {
    const now = new Date().toISOString()
    const connector = {
      enqueueTask: vi.fn(async () => ({ taskId: 'existing', taskDir: '' })),
      runTaskNow: vi.fn(async () => {}),
    } as unknown as TaktConnectorCli
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({ connector, refreshState })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([
      {
        id: 'existing',
        title: 'Was pending',
        priority: 'normal',
        status: 'running',
        source: 'takt',
        workflow: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ])
    const service = new TaskCommandService(port)

    await expect(service.runPendingTask('existing', connector)).rejects.toThrow(
      /not pending \(status: running\)/,
    )
    expect(refreshState).toHaveBeenCalled()
    expect(connector.runTaskNow).not.toHaveBeenCalled()
  })

  it('deleteTask: selects next task from fresh tasks.yaml after delete', async () => {
    const now = new Date().toISOString()
    const persistUiState = vi.fn(async () => {})
    const port = createPort({
      uiState: { selectedTaskId: 'delete-me' } as UiState,
      persistUiState,
    })
    const remainingTask = {
      id: 'keep-me',
      title: 'Keep',
      priority: 'normal' as const,
      status: 'pending' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([remainingTask])
    vi.spyOn(deleteTaskPackage, 'deletePendingTaskPackage').mockResolvedValue(true)

    const service = new TaskCommandService(port)
    await service.deleteTask('delete-me')

    expect(persistUiState).toHaveBeenCalledWith({ selectedTaskId: 'keep-me' })
  })

  it('runPendingTask: rejects when target task is not pending', async () => {
    const now = new Date().toISOString()
    const port = createPort()
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([
      {
        id: 'done-1',
        title: 'Completed task',
        priority: 'normal',
        status: 'completed',
        source: 'takt',
        createdAt: now,
        updatedAt: now,
      },
    ])
    const service = new TaskCommandService(port)

    await expect(service.runPendingTask('done-1', port.connector ?? null)).rejects.toThrow(
      /not pending/,
    )
  })

  it('stopTask: transitions running mock task to stopped', async () => {
    const now = new Date().toISOString()
    const save = vi.fn(async () => {})
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({
      mockQueueEnabled: () => true,
      mockTasks: [
        {
          id: 'mock-running',
          title: 'running task',
          priority: 'normal',
          status: 'running',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
      mockQueueStore: { save } as unknown as TaskCommandPort['mockQueueStore'],
      refreshState,
    })
    const service = new TaskCommandService(port)

    await service.stopTask('mock-running')

    expect(port.mockTasks[0]?.status).toBe('stopped')
    expect(save).toHaveBeenCalledTimes(1)
    expect(refreshState).toHaveBeenCalledTimes(1)
  })

  it('resumeStoppedTask: transitions stopped mock task back to running', async () => {
    const now = new Date().toISOString()
    const save = vi.fn(async () => {})
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({
      mockQueueEnabled: () => true,
      mockTasks: [
        {
          id: 'mock-stopped',
          title: 'stopped task',
          priority: 'normal',
          status: 'stopped',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
      mockQueueStore: { save } as unknown as TaskCommandPort['mockQueueStore'],
      refreshState,
    })
    const service = new TaskCommandService(port)

    await service.resumeStoppedTask('mock-stopped')

    expect(port.mockTasks[0]?.status).toBe('running')
    expect(save).toHaveBeenCalledTimes(1)
    expect(refreshState).toHaveBeenCalledTimes(1)
  })

  it('stopTask: rejects when task is not running', async () => {
    const now = new Date().toISOString()
    const port = createPort({
      mockQueueEnabled: () => true,
      mockTasks: [
        {
          id: 'mock-pending',
          title: 'pending task',
          priority: 'normal',
          status: 'pending',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
    })
    const service = new TaskCommandService(port)

    await expect(service.stopTask('mock-pending')).rejects.toThrow(/not running/)
  })

  it('stopTask: bundled takt stops running task via owner_pid', async () => {
    const now = new Date().toISOString()
    const runningTask = {
      id: 'takt-running',
      title: 'running task',
      priority: 'normal' as const,
      status: 'running' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    const invalidate = vi.fn()
    const syncWatchConnection = vi.fn(async () => {})
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({
      mockQueueEnabled: () => false,
      invalidateTaktTaskYamlCache: invalidate,
      syncWatchConnection,
      refreshState,
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([runningTask])

    const runningTaskStop = await import('../lib/running-task-stop.js')
    vi.spyOn(runningTaskStop, 'resolveRunningTaskOwnerPid').mockResolvedValue({
      kind: 'ok',
      pid: 9001,
    })
    vi.spyOn(runningTaskStop, 'stopProcessGracefully').mockResolvedValue('stopped')
    vi.spyOn(runningTaskStop, 'reconcileStaleRunningAfterStop').mockResolvedValue(false)

    const service = new TaskCommandService(port)
    await service.stopTask('takt-running')

    expect(runningTaskStop.stopProcessGracefully).toHaveBeenCalledWith(9001)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(syncWatchConnection).toHaveBeenCalledWith(9001)
    expect(refreshState).toHaveBeenCalledTimes(1)
    expect(runningTaskStop.reconcileStaleRunningAfterStop).toHaveBeenCalled()
  })

  it('stopTask: bundled takt still reconciles when process is already gone', async () => {
    const now = new Date().toISOString()
    const runningTask = {
      id: 'takt-running',
      title: 'running task',
      priority: 'normal' as const,
      status: 'running' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    const invalidate = vi.fn()
    const syncWatchConnection = vi.fn(async () => {})
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({
      mockQueueEnabled: () => false,
      invalidateTaktTaskYamlCache: invalidate,
      syncWatchConnection,
      refreshState,
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([runningTask])

    const runningTaskStop = await import('../lib/running-task-stop.js')
    vi.spyOn(runningTaskStop, 'resolveRunningTaskOwnerPid').mockResolvedValue({
      kind: 'ok',
      pid: 4242,
    })
    vi.spyOn(runningTaskStop, 'stopProcessGracefully').mockResolvedValue('not_found')
    const reconcileSpy = vi
      .spyOn(runningTaskStop, 'reconcileStaleRunningAfterStop')
      .mockResolvedValue(false)

    const service = new TaskCommandService(port)
    await service.stopTask('takt-running')

    expect(syncWatchConnection).toHaveBeenCalledWith(4242)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(refreshState).toHaveBeenCalledTimes(1)
    expect(reconcileSpy).toHaveBeenCalled()
  })

  it('stopTask: bundled takt rejects when owner_pid cannot be resolved', async () => {
    const now = new Date().toISOString()
    const runningTask = {
      id: 'takt-running',
      title: 'running task',
      priority: 'normal' as const,
      status: 'running' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    const port = createPort({ mockQueueEnabled: () => false })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([runningTask])

    const runningTaskStop = await import('../lib/running-task-stop.js')
    vi.spyOn(runningTaskStop, 'resolveRunningTaskOwnerPid').mockResolvedValue({
      kind: 'no_owner_pid',
    })

    const service = new TaskCommandService(port)
    await expect(service.stopTask('takt-running')).rejects.toThrow(/No owner process found/)
  })

  it('stopTask: bundled takt rejects when process does not stop in time', async () => {
    const now = new Date().toISOString()
    const runningTask = {
      id: 'takt-running',
      title: 'running task',
      priority: 'normal' as const,
      status: 'running' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    const port = createPort({ mockQueueEnabled: () => false })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([runningTask])

    const runningTaskStop = await import('../lib/running-task-stop.js')
    vi.spyOn(runningTaskStop, 'resolveRunningTaskOwnerPid').mockResolvedValue({
      kind: 'ok',
      pid: 99,
    })
    vi.spyOn(runningTaskStop, 'stopProcessGracefully').mockResolvedValue('timeout')

    const service = new TaskCommandService(port)
    await expect(service.stopTask('takt-running')).rejects.toThrow(/did not stop in time/)
  })

  it('stopTask: bundled takt refreshes again when force-fail runs', async () => {
    const now = new Date().toISOString()
    const runningTask = {
      id: 'takt-running',
      title: 'running task',
      priority: 'normal' as const,
      status: 'running' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    const invalidate = vi.fn()
    const refreshState = vi.fn(async () => ({}) as AppState)
    const port = createPort({
      mockQueueEnabled: () => false,
      invalidateTaktTaskYamlCache: invalidate,
      refreshState,
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([runningTask])

    const runningTaskStop = await import('../lib/running-task-stop.js')
    vi.spyOn(runningTaskStop, 'resolveRunningTaskOwnerPid').mockResolvedValue({
      kind: 'ok',
      pid: 42,
    })
    vi.spyOn(runningTaskStop, 'stopProcessGracefully').mockResolvedValue('stopped')
    vi.spyOn(runningTaskStop, 'reconcileStaleRunningAfterStop').mockResolvedValue(true)

    const service = new TaskCommandService(port)
    await service.stopTask('takt-running')

    expect(invalidate).toHaveBeenCalledTimes(2)
    expect(refreshState).toHaveBeenCalledTimes(2)
  })

  it('resumeStoppedTask: rejects when task is not stopped', async () => {
    const now = new Date().toISOString()
    const port = createPort({
      mockQueueEnabled: () => true,
      mockTasks: [
        {
          id: 'mock-running',
          title: 'running task',
          priority: 'normal',
          status: 'running',
          source: 'user',
          createdAt: now,
          updatedAt: now,
        },
      ],
    })
    const service = new TaskCommandService(port)

    await expect(service.resumeStoppedTask('mock-running')).rejects.toThrow(/not stopped/)
  })

  it('resumeStoppedTask: rejects in bundled takt mode', async () => {
    const now = new Date().toISOString()
    const stoppedTask = {
      id: 'mock-stopped',
      title: 'stopped task',
      priority: 'normal' as const,
      status: 'stopped' as const,
      source: 'takt' as const,
      createdAt: now,
      updatedAt: now,
    }
    const port = createPort({ mockQueueEnabled: () => false })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([stoppedTask])
    const service = new TaskCommandService(port)

    await expect(service.resumeStoppedTask('mock-stopped')).rejects.toThrow(
      /not supported in bundled takt mode/,
    )
  })

  it('syncs taskAssignments via syncUiState from resolved execution profile on enqueue', async () => {
    const syncUiState = vi.fn()
    const port = createPort({
      syncUiState,
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'cursor',
        model: 'auto',
      })),
      loadEffectiveEngineConfig: vi.fn(async () => ({
        provider: 'cursor',
        model: 'auto',
      })),
    })
    const service = new TaskCommandService(port)
    await service.enqueueTask({ title: 'Run', body: 'body', workflow: 'default' })

    expect(syncUiState).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTaskId: 'queued-1',
        taskAssignments: { 'queued-1': 'agent-external-cursor' },
      }),
    )
    expect(port.persistUiState).not.toHaveBeenCalled()
  })

  it('allows enqueue for ollama with ollama-chat builtin workflow', async () => {
    const port = createPort({
      config: {
        ...DEFAULT_CONFIG,
        ui: {
          ...DEFAULT_CONFIG.ui,
          ollama: { toolsGuard: 'block' },
        },
      },
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'ollama',
        model: 'llama3.2',
      })),
      readWorkflowYaml: vi.fn(async (name) =>
        name === 'ollama-chat' ? BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML : null,
      ),
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    await service.enqueueTask({ title: 'Run', body: 'body', workflow: 'ollama-chat' })

    expect(port.connector?.enqueueTask).toHaveBeenCalled()
  })

  it('previewOllamaExecutionGuard blocks incompatible workflow even when ollama-chat exists', async () => {
    const port = createPort({
      config: {
        ...DEFAULT_CONFIG,
        ui: {
          ...DEFAULT_CONFIG.ui,
          ollama: { toolsGuard: 'block' },
        },
      },
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'ollama',
        model: 'llama3.2',
      })),
      readWorkflowYaml: vi.fn(async (name) => {
        if (name === 'ollama-chat') return BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML
        return BUILTIN_DEFAULT_WORKFLOW_YAML
      }),
      listAvailableWorkflowNames: vi.fn(async () => ['default', 'minimal', 'ollama-chat']),
    })
    const service = new TaskCommandService(port)

    const preview = await service.previewOllamaExecutionGuard({
      title: 'Run',
      body: 'body',
      workflow: 'default',
    })

    expect(preview.action).toBe('block')
    expect(preview.issues.length).toBeGreaterThan(0)
  })

  it('previewOllamaExecutionGuard matches enqueue guard for ollama default workflow', async () => {
    const port = createPort({
      config: {
        ...DEFAULT_CONFIG,
        ui: {
          ...DEFAULT_CONFIG.ui,
          ollama: { toolsGuard: 'warn' },
        },
      },
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'ollama',
        model: 'llama3.2',
      })),
      readWorkflowYaml: vi.fn(async () => BUILTIN_DEFAULT_WORKFLOW_YAML),
    })
    const service = new TaskCommandService(port)

    const preview = await service.previewOllamaExecutionGuard({
      title: 'Run',
      body: 'body',
      workflow: 'default',
    })

    expect(preview.action).toBe('warn')
    expect(preview.issues.length).toBeGreaterThan(0)
  })

  it('blocks enqueue when ollama runs an edit-heavy workflow and ollama-chat is unavailable', async () => {
    const port = createPort({
      config: {
        ...DEFAULT_CONFIG,
        ui: {
          ...DEFAULT_CONFIG.ui,
          ollama: { toolsGuard: 'block' },
        },
      },
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'ollama',
        model: 'llama3.2',
      })),
      readWorkflowYaml: vi.fn(async () => BUILTIN_DEFAULT_WORKFLOW_YAML),
      listAvailableWorkflowNames: vi.fn(async () => ['default', 'minimal']),
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    await expect(
      service.enqueueTask({ title: 'Run', body: 'body', workflow: 'default' }),
    ).rejects.toBeInstanceOf(OllamaExecutionBlockedError)
    expect(port.connector?.enqueueTask).not.toHaveBeenCalled()
  })

  it('blocks enqueue when ollama runs an edit-heavy workflow even when ollama-chat exists', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' }))
    const port = createPort({
      config: {
        ...DEFAULT_CONFIG,
        ui: {
          ...DEFAULT_CONFIG.ui,
          ollama: { toolsGuard: 'block' },
        },
      },
      connector: { enqueueTask, runTaskNow: vi.fn() } as unknown as TaktConnectorCli,
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'ollama',
        model: 'llama3.2',
      })),
      readWorkflowYaml: vi.fn(async (name) => {
        if (name === 'minimal') return BUILTIN_MINIMAL_WORKFLOW_YAML
        if (name === 'ollama-chat') return BUILTIN_OLLAMA_CHAT_WORKFLOW_YAML
        return null
      }),
      listAvailableWorkflowNames: vi.fn(async () => ['default', 'minimal', 'ollama-chat']),
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    await expect(
      service.enqueueTask({ title: 'Run', body: 'body', workflow: 'minimal' }),
    ).rejects.toBeInstanceOf(OllamaExecutionBlockedError)
    expect(enqueueTask).not.toHaveBeenCalled()
  })

  it('does not remap when ollama toolsGuard is off', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' }))
    const port = createPort({
      config: {
        ...DEFAULT_CONFIG,
        ui: {
          ...DEFAULT_CONFIG.ui,
          ollama: { toolsGuard: 'off' },
        },
      },
      connector: { enqueueTask, runTaskNow: vi.fn() } as unknown as TaktConnectorCli,
      resolveExecutionProfileForInput: vi.fn(async () => ({
        provider: 'ollama',
        model: 'llama3.2',
      })),
      readWorkflowYaml: vi.fn(async () => BUILTIN_MINIMAL_WORKFLOW_YAML),
      listAvailableWorkflowNames: vi.fn(async () => ['default', 'minimal', 'ollama-chat']),
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    await service.enqueueTask({
      title: 'Run',
      body: 'body',
      workflow: 'minimal',
    })

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: 'minimal' }),
      expect.any(Set),
    )
  })

  it('resolves workflow in auto mode before title generation', async () => {
    mockStructureRoutingLlm('default')
    const port = createPort()
    const resolveSpy = vi.spyOn(titleGenerator, 'resolveEnqueueInput')
    const service = new TaskCommandService(port)

    const result = await service.enqueueTask({
      body: 'fix login bug in auth module',
      workflowMode: 'auto',
    })

    expect(result.autoDecision?.selectedWorkflow).toBe('default')
    expect(result.taskId).toBeTruthy()
    expect(resolveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: result.autoDecision?.selectedWorkflow,
        workflowMode: 'manual',
      }),
      expect.anything(),
    )
  })

  it('ignores runOverride when selected workflow does not match override base', async () => {
    const enqueueTask = vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' }))
    const port = createPort({
      connector: { enqueueTask, runTaskNow: vi.fn() } as unknown as TaktConnectorCli,
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    await service.enqueueTask({
      title: 'Run',
      body: 'body',
      workflow: 'minimal',
      runOverride: {
        baseWorkflow: 'default',
        stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
      },
    })

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: 'minimal' }),
      expect.any(Set),
    )
  })

  it('does not reuse deterministic preview cache entries during auto enqueue', async () => {
    const routingSpy = mockStructureRoutingLlm('default')
    const port = createPort({
      listAvailableWorkflowNames: vi.fn(async () => ['default']),
      listWorkflowSummaries: vi.fn(async () => [{ name: 'default', source: 'builtin' as const }]),
      loadWorkflowRoutingCatalog: vi.fn(async () => ({
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          {
            name: 'default',
            enabledForAuto: true,
            routingGroups: ['general' as const],
            safetyTier: 'strict' as const,
          },
        ],
      })),
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    const preview = await service.previewWorkflowAutoRoute({
      body: 'fix login bug in auth module',
      phase: 'deterministic',
    })
    routingSpy.mockClear()

    await service.enqueueTask({
      body: 'fix login bug in auth module',
      workflowMode: 'auto',
      routingPreviewToken: preview.previewToken,
      routingPromptHash: preview.promptHash,
    })

    const finalCalls = routingSpy.mock.calls.filter((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCalls.length).toBeGreaterThan(0)
  })

  it('reuses full preview cache entries during auto enqueue', async () => {
    const routingSpy = mockStructureRoutingLlm('default')
    const port = createPort({
      listAvailableWorkflowNames: vi.fn(async () => ['default']),
      listWorkflowSummaries: vi.fn(async () => [{ name: 'default', source: 'builtin' as const }]),
      loadWorkflowRoutingCatalog: vi.fn(async () => ({
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          {
            name: 'default',
            enabledForAuto: true,
            routingGroups: ['general' as const],
            safetyTier: 'strict' as const,
          },
        ],
      })),
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)

    const preview = await service.previewWorkflowAutoRoute({
      body: 'fix login bug in auth module',
      phase: 'full',
    })
    routingSpy.mockClear()

    const result = await service.enqueueTask({
      body: 'fix login bug in auth module',
      workflowMode: 'auto',
      routingPreviewToken: preview.previewToken,
      routingPromptHash: preview.promptHash,
    })

    expect(result.autoDecision?.selectedWorkflow).toBe(preview.decision.selectedWorkflow)
    expect(routingSpy).not.toHaveBeenCalled()
  })

  async function enqueueAndExpectSelectionMeta(
    input: EnqueueTaskBridgeInput,
    expectedMeta: TaskWorkflowSelectionMeta,
    options?: { expectConnectorWorkflow?: string },
  ): Promise<void> {
    const enqueueTask = vi.fn(async () => ({ taskId: 'queued-1', taskDir: '' }))
    const port = createPort({
      connector: { enqueueTask, runTaskNow: vi.fn() } as unknown as TaktConnectorCli,
    })
    vi.spyOn(port, 'readTaktTasksFresh').mockResolvedValue([])
    const service = new TaskCommandService(port)
    await service.enqueueTask(input)
    if (options?.expectConnectorWorkflow) {
      expect(enqueueTask).toHaveBeenCalledWith(
        expect.objectContaining({ workflow: options.expectConnectorWorkflow }),
        expect.any(Set),
      )
    }
    expect(sidecarWriteScope.persistEnqueueSidecar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workflowSelectionMeta: expectedMeta }),
    )
  }

  const autoMinimalMeta: TaskWorkflowSelectionMeta = {
    kind: 'auto',
    baseWorkflow: 'minimal',
    resolvedWorkflow: 'minimal',
  }

  it.each([
    [
      'confirmed auto enqueue',
      {
        title: 'Run',
        body: 'body',
        workflowMode: 'auto' as const,
        confirmedWorkflow: 'minimal',
      },
      autoMinimalMeta,
      undefined,
    ],
    [
      'confirmed auto enqueue with stale runOverride',
      {
        title: 'Run',
        body: 'body',
        workflowMode: 'auto' as const,
        confirmedWorkflow: 'minimal',
        runOverride: {
          baseWorkflow: 'default',
          stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
        },
      },
      autoMinimalMeta,
      { expectConnectorWorkflow: 'minimal' },
    ],
  ])('records auto selection meta for %s', async (_label, input, expectedMeta, options) => {
    await enqueueAndExpectSelectionMeta(input, expectedMeta, options)
  })

  it('excludes chat-only workflow from auto routing candidates', async () => {
    const routingSpy = mockStructureRoutingLlm('default')
    const port = createPort({
      listAvailableWorkflowNames: vi.fn(async () => ['default', CHAT_INVESTIGATION_WORKFLOW_NAME]),
      loadWorkflowRoutingCatalog: vi.fn(async () => ({
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          {
            name: 'default',
            enabledForAuto: true,
            routingGroups: ['general' as const],
          },
          {
            name: CHAT_INVESTIGATION_WORKFLOW_NAME,
            enabledForAuto: true,
            routingGroups: ['general' as const],
          },
        ],
      })),
    })
    const service = new TaskCommandService(port)

    const result = await service.enqueueTask({
      body: 'investigate flaky tests',
      workflowMode: 'auto',
    })

    const finalCalls = routingSpy.mock.calls.filter((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCalls).toHaveLength(0)
    expect(result.autoDecision?.selectedWorkflow).toBe('default')
  })

  it('does not call routing LLM during Ollama guard preview', async () => {
    const routingSpy = vi.spyOn(workflowAutoLlm, 'callWorkflowAutoRoutingLlmJson')
    const port = createPort()
    const service = new TaskCommandService(port)

    await service.previewOllamaExecutionGuard({
      body: 'run with ollama',
      workflowMode: 'auto',
    })

    expect(routingSpy).not.toHaveBeenCalled()
  })
})
