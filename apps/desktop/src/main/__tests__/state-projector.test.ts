import {
  DEFAULT_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  EXECUTOR_ID_CODEX,
  EXECUTOR_ID_CURSOR,
  formatRunId,
  type IntegrationsState,
  type RunEvent,
  type TaskViewModel,
  type WorkflowSummary,
} from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import type { RunTraceEvent } from '../lib/run-trace-types.js'
import { MOCK_AGENTS } from '../mock/mock-data.js'
import { type ProjectionInput, projectAppState } from '../state-projector.js'

const TEST_INTEGRATIONS: IntegrationsState = {
  hookServer: { enabled: false, bind: '127.0.0.1', port: 17_840, hasSecret: false },
  adapters: [
    {
      id: 'cursor',
      displayName: 'Cursor',
      enabled: false,
      description: 'test',
    },
  ],
}

const DEFAULT_WORKFLOWS: WorkflowSummary[] = [
  {
    name: 'default',
    source: 'project',
    stepNames: ['plan', 'implement', 'review'],
    agentRoles: ['planner', 'coder', 'reviewer'],
    steps: [
      { name: 'plan', persona: 'planner' },
      { name: 'implement', persona: 'coder' },
      { name: 'review', persona: 'reviewer' },
    ],
    isOverridden: false,
    diagnostics: [],
  },
]

const DEFAULT_TASKS: TaskViewModel[] = [
  {
    id: 'task-1',
    title: 'Task',
    status: 'running',
    priority: 'normal',
    source: 'takt',
    createdAt: '2026-05-24T09:00:00.000Z',
    updatedAt: '2026-05-24T10:00:00.000Z',
    workflow: 'default',
  },
]

function projectionInput(
  partial: Partial<Omit<ProjectionInput, 'runEvents' | 'runTraces'>> &
    Pick<ProjectionInput, 'runEvents'> & { runTraces?: ProjectionInput['runTraces'] },
): ProjectionInput {
  const { runTraces, ...rest } = partial
  return {
    workspacePath: '/tmp/ws',
    sidecarPath: '/tmp/ws/.orbit',
    isWritable: true,
    config: { ...DEFAULT_CONFIG },
    uiState: {},
    connection: { cli: 'ok' as const, watch: 'stopped' as const },
    tasks: DEFAULT_TASKS,
    workflows: DEFAULT_WORKFLOWS,
    executorTemplates: MOCK_AGENTS,
    engine: DEFAULT_ENGINE_CONFIG,
    agentOverrides: {},
    pendingProfilesByTaskId: new Map(),
    chains: [],
    integrations: TEST_INTEGRATIONS,
    runTraces: runTraces ?? [],
    ...rest,
  }
}

describe('projectAppState', () => {
  it('does not project liveActivity for terminal tasks even when traces exist', () => {
    const runId = formatRunId('dir-done', 'sess-done')
    const traces: RunTraceEvent[] = [
      {
        runId,
        runDirSlug: 'dir-done',
        sessionId: 'sess-done',
        taskId: 'task-1',
        type: 'thinking',
        at: '2026-05-24T10:00:00.000Z',
        text: 'Should not surface',
      },
    ]
    const state = projectAppState(
      projectionInput({
        runEvents: [],
        runTraces: traces,
        tasks: [
          {
            id: 'task-1',
            title: 'Done task',
            status: 'completed',
            priority: 'normal',
            source: 'takt',
            createdAt: '2026-05-24T09:00:00.000Z',
            updatedAt: '2026-05-24T10:00:00.000Z',
          },
        ],
      }),
    )
    const task = state.tasks[0]
    expect(task.liveActivity).toBeUndefined()
    expect(task.executionStatus).toBeUndefined()
  })

  it('projects liveActivity for running tasks without workflow step names', () => {
    const runId = formatRunId('dir-solo', 'sess-solo')
    const traces: RunTraceEvent[] = [
      {
        runId,
        runDirSlug: 'dir-solo',
        sessionId: 'sess-solo',
        taskId: 'task-1',
        type: 'tool_use',
        at: '2026-05-24T10:00:00.000Z',
        toolName: 'Grep',
      },
    ]
    const state = projectAppState(
      projectionInput({
        runEvents: [],
        runTraces: traces,
        tasks: [
          {
            id: 'task-1',
            title: 'Solo run',
            status: 'running',
            priority: 'normal',
            source: 'takt',
            createdAt: '2026-05-24T09:00:00.000Z',
            updatedAt: '2026-05-24T10:00:00.000Z',
          },
        ],
        workflows: [],
      }),
    )
    const task = state.tasks[0]
    expect(task.liveActivity?.length).toBe(1)
    expect(task.workflowStepActivities).toBeUndefined()
  })

  it('backfills liveActivity from workflow step activities when traces yield no task feed', () => {
    const runId = formatRunId('dir-wf-backfill', 'sess-wf-backfill')
    const traces: RunTraceEvent[] = [
      {
        runId,
        runDirSlug: 'dir-wf-backfill',
        sessionId: 'sess-wf-backfill',
        taskId: 'task-1',
        type: 'phase_complete',
        at: '2026-05-24T10:00:01.000Z',
        phaseName: 'report',
        content: 'Planner output only in phase payload',
      },
    ]
    const state = projectAppState(
      projectionInput({
        runEvents: [],
        runTraces: traces,
        workflows: [
          {
            name: 'wf',
            description: '',
            source: 'builtin',
            stepNames: ['plan', 'implement'],
            steps: [],
            agentRoles: [],
            isOverridden: false,
            diagnostics: [],
          },
        ],
        tasks: [
          {
            id: 'task-1',
            title: 'WF',
            status: 'running',
            priority: 'normal',
            source: 'takt',
            workflow: 'wf',
            createdAt: '2026-05-24T09:00:00.000Z',
            updatedAt: '2026-05-24T10:00:00.000Z',
          },
        ],
      }),
    )
    const task = state.tasks[0]
    expect(task.liveActivity?.length).toBeGreaterThan(0)
    expect(task.executionStatus?.lastEventSummary).toContain('Planner output')
  })

  it('aligns executionStatus summary with the last liveActivity entry for running workflow tasks', () => {
    const runId = formatRunId('dir-wf', 'sess-wf')
    const traces: RunTraceEvent[] = [
      {
        runId,
        runDirSlug: 'dir-wf',
        sessionId: 'sess-wf',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T10:00:00.000Z',
        stepName: 'implement',
        text: 'implement',
      },
      {
        runId,
        runDirSlug: 'dir-wf',
        sessionId: 'sess-wf',
        taskId: 'task-1',
        type: 'thinking',
        at: '2026-05-24T10:00:01.000Z',
        text: 'Latest thought',
        stepName: 'implement',
      },
    ]
    const state = projectAppState(projectionInput({ runEvents: [], runTraces: traces }))
    const task = state.tasks[0]
    const last = task.liveActivity?.[task.liveActivity.length - 1]
    expect(last?.text).toBe('Latest thought')
    expect(task.executionStatus?.lastEventSummary).toBe(last?.text)
    expect(task.workflowStepActivities?.length).toBeGreaterThan(0)
  })

  it('projects liveActivity and executionStatus for running tasks from run traces', () => {
    const runId = formatRunId('dir-live', 'sess-live')
    const traces: RunTraceEvent[] = [
      {
        runId,
        runDirSlug: 'dir-live',
        sessionId: 'sess-live',
        taskId: 'task-1',
        type: 'thinking',
        at: '2026-05-24T10:00:00.000Z',
        text: 'Planning next action',
      },
    ]
    const state = projectAppState(projectionInput({ runEvents: [], runTraces: traces }))
    const task = state.tasks[0]
    expect(task.liveActivity?.length).toBe(1)
    expect(task.liveActivity?.[0].kind).toBe('thinking')
    expect(task.executionStatus?.lastEventSummary).toContain('Planning')
  })

  it('sets activeStep from run events without exposing RunEvent[] on AppState', () => {
    const runId = formatRunId('dir-a', 'sess-1')
    const events: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 'sess-1',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T10:00:00.000Z',
        message: 'plan',
      },
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 'sess-1',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T10:05:00.000Z',
        message: 'implement',
      },
    ]
    const input = projectionInput({ runEvents: events })
    const state = projectAppState(input)
    expect(state.tasks[0].activeStep).toBe('implement')
    expect('runEvents' in state).toBe(false)
  })

  it('scopes activeStep to activeRunId so two sessions for the same task do not merge', () => {
    const runA = formatRunId('dir-a', 'sess-a')
    const runB = formatRunId('dir-a', 'sess-b')
    const events: RunEvent[] = [
      {
        runId: runA,
        runDirSlug: 'dir-a',
        sessionId: 'sess-a',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T09:00:00.000Z',
        message: 'plan',
      },
      {
        runId: runB,
        runDirSlug: 'dir-a',
        sessionId: 'sess-b',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T11:00:00.000Z',
        message: 'implement',
      },
    ]
    const base = projectionInput({
      runEvents: events,
      tasks: [
        {
          id: 'task-1',
          title: 'Task',
          status: 'running',
          priority: 'normal',
          source: 'takt',
          createdAt: '2026-05-24T08:00:00.000Z',
          updatedAt: '2026-05-24T11:00:00.000Z',
          workflow: 'default',
        },
      ],
    })

    const latestRun = projectAppState({ ...base, uiState: {} })
    expect(latestRun.tasks[0].activeRunId).toBe(runB)
    expect(latestRun.tasks[0].activeStep).toBe('implement')

    const pinnedToA = projectAppState({
      ...base,
      uiState: { activeRunByTaskId: { 'task-1': runA } },
    })
    expect(pinnedToA.tasks[0].activeRunId).toBe(runA)
    expect(pinnedToA.tasks[0].activeStep).toBe('plan')
  })

  it('ignores stale activeRunByTaskId when that run has no events for the task', () => {
    const runA = formatRunId('dir-a', 'sess-a')
    const runB = formatRunId('dir-a', 'sess-b')
    const events: RunEvent[] = [
      {
        runId: runA,
        runDirSlug: 'dir-a',
        sessionId: 'sess-a',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T09:00:00.000Z',
        message: 'plan',
      },
      {
        runId: runB,
        runDirSlug: 'dir-a',
        sessionId: 'sess-b',
        taskId: 'task-1',
        type: 'step_start',
        at: '2026-05-24T11:00:00.000Z',
        message: 'implement',
      },
    ]
    const state = projectAppState(
      projectionInput({
        runEvents: events,
        uiState: { activeRunByTaskId: { 'task-1': 'ghost-run:no-events' } },
      }),
    )
    expect(state.tasks[0].activeRunId).toBe(runB)
    expect(state.tasks[0].activeStep).toBe('implement')
  })

  it('projects executors and attribution from taskAssignments after activeStep', () => {
    const state = projectAppState(
      projectionInput({
        runEvents: [],
        uiState: { taskAssignments: { 'task-1': EXECUTOR_ID_CURSOR } },
        executorTemplates: [MOCK_AGENTS.find((a) => a.id === EXECUTOR_ID_CURSOR)!],
      }),
    )
    expect(state.tasks[0].executorAttribution?.source).toBe('explicit-assignment')
    expect(state.tasks[0].executorAttribution?.executorId).toBe(EXECUTOR_ID_CURSOR)
    const cursor = state.executors.find((e) => e.id === EXECUTOR_ID_CURSOR)
    expect(cursor?.status).toBe('working')
    expect(cursor?.activeTaskIds).toEqual(['task-1'])
    expect(state.agents.find((a) => a.id === EXECUTOR_ID_CURSOR)?.status).toBe('working')
  })

  it('does not use workflow-step attribution without activeStep on the task', () => {
    const engine = {
      provider: 'openai',
      model: 'gpt',
      persona_providers: { coder: { provider: 'cursor', model: 'auto' } },
    }
    const state = projectAppState(
      projectionInput({
        runEvents: [],
        engine,
        executorTemplates: [MOCK_AGENTS.find((a) => a.id === EXECUTOR_ID_CURSOR)!],
      }),
    )
    expect(state.tasks[0].executorAttribution?.source).not.toBe('workflow-step')
  })

  it('resolves workflow-step attribution after activeStep is projected', () => {
    const runId = formatRunId('dir-a', 'sess-1')
    const engine = {
      provider: 'openai',
      model: 'gpt',
      persona_providers: { coder: { provider: 'codex', model: 'auto' } },
    }
    const state = projectAppState(
      projectionInput({
        runEvents: [
          {
            runId,
            runDirSlug: 'dir-a',
            sessionId: 'sess-1',
            taskId: 'task-1',
            type: 'step_start',
            at: '2026-05-24T10:00:00.000Z',
            message: 'implement',
          },
        ],
        engine,
        executorTemplates: [MOCK_AGENTS.find((a) => a.id === EXECUTOR_ID_CODEX)!],
      }),
    )
    expect(state.tasks[0].activeStep).toBe('implement')
    expect(state.tasks[0].executorAttribution?.source).toBe('workflow-step')
    expect(state.tasks[0].executorAttribution?.executorId).toBe(EXECUTOR_ID_CODEX)
    expect(state.tasks[0].executorAttribution?.personaSource).toBe('workflow-yaml')
  })

  it('prefers runtime-event persona on step_start when present', () => {
    const runId = formatRunId('dir-a', 'sess-1')
    const engine = {
      persona_providers: { specialist: { provider: 'cursor', model: 'auto' } },
    }
    const state = projectAppState(
      projectionInput({
        runEvents: [
          {
            runId,
            runDirSlug: 'dir-a',
            sessionId: 'sess-1',
            taskId: 'task-1',
            type: 'step_start',
            at: '2026-05-24T10:00:00.000Z',
            step: 'implement',
            message: 'implement',
            persona: 'specialist',
          },
        ],
        engine,
        executorTemplates: [MOCK_AGENTS.find((a) => a.id === EXECUTOR_ID_CURSOR)!],
      }),
    )
    expect(state.tasks[0].executorAttribution?.persona).toBe('specialist')
    expect(state.tasks[0].executorAttribution?.personaSource).toBe('runtime-event')
    expect(state.tasks[0].executorAttribution?.executorId).toBe(EXECUTOR_ID_CURSOR)
  })

  it('resolves activeStep when workflow is identified by a file path (Orbit runtime format)', () => {
    const runId = formatRunId('dir-a', 'sess-1')
    const events: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 'sess-1',
        taskId: 'task-1',
        type: 'step_complete',
        at: '2026-05-24T10:05:00.000Z',
        message: 'plan',
      },
    ]
    const state = projectAppState(
      projectionInput({
        runEvents: events,
        tasks: [
          {
            ...DEFAULT_TASKS[0],
            // Orbit stores the full relative path in tasks.yaml
            workflow: '.orbit/runtime-workflows/default.yaml',
          },
        ],
      }),
    )
    expect(state.tasks[0].activeStep).toBe('implement')
  })

  it('clears activeStep for terminal failed tasks and synthesizes failure from statusReason', () => {
    const runId = formatRunId('dir-a', 'sess-1')
    const events: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 'sess-1',
        taskId: 'task-1',
        type: 'step_complete',
        at: '2026-05-24T10:05:00.000Z',
        message: 'implement',
      },
    ]
    const state = projectAppState(
      projectionInput({
        runEvents: events,
        tasks: [
          {
            ...DEFAULT_TASKS[0],
            status: 'failed',
            statusReason: 'pr_failed',
            rawStatus: 'pr_failed',
          },
        ],
      }),
    )
    expect(state.tasks[0].activeStep).toBeUndefined()
    expect(state.tasks[0].activeRunId).toBeUndefined()
    expect(state.tasks[0].failure?.kind).toBe('failed')
    expect(state.tasks[0].failure?.failedAt).toBe(state.tasks[0].updatedAt)
    expect(state.tasks[0].failure?.runId).toBe(runId)
  })

  it('treats interrupted and aborted rows as terminal failed states during projection', () => {
    const runId = formatRunId('dir-a', 'sess-1')
    const events: RunEvent[] = [
      {
        runId,
        runDirSlug: 'dir-a',
        sessionId: 'sess-1',
        taskId: 'task-1',
        type: 'step_complete',
        at: '2026-05-24T10:05:00.000Z',
        message: 'implement',
      },
    ]

    const interrupted = projectAppState(
      projectionInput({
        runEvents: events,
        tasks: [
          {
            ...DEFAULT_TASKS[0],
            status: 'failed',
            statusReason: 'interrupted',
            rawStatus: 'interrupted',
          },
        ],
      }),
    )
    expect(interrupted.tasks[0].activeStep).toBeUndefined()
    expect(interrupted.tasks[0].activeRunId).toBeUndefined()
    expect(interrupted.tasks[0].failure?.kind).toBe('failed')
    expect(interrupted.tasks[0].failure?.failedAt).toBe(interrupted.tasks[0].updatedAt)

    const aborted = projectAppState(
      projectionInput({
        runEvents: events,
        tasks: [
          {
            ...DEFAULT_TASKS[0],
            status: 'failed',
            statusReason: 'workflow_aborted',
            rawStatus: 'aborted',
          },
        ],
      }),
    )
    expect(aborted.tasks[0].activeStep).toBeUndefined()
    expect(aborted.tasks[0].activeRunId).toBeUndefined()
    expect(aborted.tasks[0].failure?.kind).toBe('failed')
    expect(aborted.tasks[0].failure?.failedAt).toBe(aborted.tasks[0].updatedAt)
  })

  it('sorts tasks by createdAt descending for task list display', () => {
    const state = projectAppState(
      projectionInput({
        runEvents: [],
        tasks: [
          { ...DEFAULT_TASKS[0], id: 'older', createdAt: '2026-05-24T08:00:00.000Z' },
          { ...DEFAULT_TASKS[0], id: 'newer', createdAt: '2026-05-24T10:00:00.000Z' },
          { ...DEFAULT_TASKS[0], id: 'middle', createdAt: '2026-05-24T09:00:00.000Z' },
        ],
      }),
    )
    expect(state.tasks.map((t) => t.id)).toEqual(['newer', 'middle', 'older'])
  })
})
