import {
  EXECUTOR_ID_CURSOR,
  formatRunId,
  type RunEvent,
  type TaskViewModel,
  type WorkflowSummary,
} from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { attachTaskAttributions } from '../lib/projection/executor-attribution-projection.js'

const WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'builtin',
  stepNames: ['implement'],
  agentRoles: ['coder'],
  steps: [{ name: 'implement', persona: 'coder' }],
  isOverridden: false,
  diagnostics: [],
}

const RUNNING_TASK: TaskViewModel = {
  id: 'task-a',
  title: 'A',
  status: 'running',
  priority: 'normal',
  source: 'takt',
  createdAt: '2026-05-27T10:00:00.000Z',
  updatedAt: '2026-05-27T10:00:00.000Z',
  workflow: 'default',
  activeStep: 'implement',
}

describe('attachTaskAttributions', () => {
  it('scopes run events per task so another task persona does not leak', () => {
    const runId = formatRunId('dir', 'sess')
    const runEventsByTaskId = new Map<string, RunEvent[]>([
      [
        'task-a',
        [
          {
            runId,
            runDirSlug: 'dir',
            sessionId: 'sess',
            taskId: 'task-a',
            type: 'step_start',
            at: '2026-05-27T10:00:00.000Z',
            step: 'implement',
            persona: 'specialist',
          },
        ],
      ],
      [
        'task-b',
        [
          {
            runId,
            runDirSlug: 'dir',
            sessionId: 'sess',
            taskId: 'task-b',
            type: 'step_start',
            at: '2026-05-27T10:01:00.000Z',
            step: 'implement',
            persona: 'other-persona',
          },
        ],
      ],
    ])

    const [taskA] = attachTaskAttributions({
      tasks: [RUNNING_TASK],
      workflows: [WORKFLOW],
      uiState: {},
      pendingProfilesByTaskId: new Map(),
      engine: {
        persona_providers: {
          specialist: { provider: 'cursor', model: 'auto' },
          coder: { provider: 'codex', model: 'auto' },
        },
      },
      agentOverrides: {},
      runEventsByTaskId,
    })

    expect(taskA.executorAttribution?.persona).toBe('specialist')
    expect(taskA.executorAttribution?.personaSource).toBe('runtime-event')
    expect(taskA.executorAttribution?.executorId).toBe(EXECUTOR_ID_CURSOR)
  })
})
