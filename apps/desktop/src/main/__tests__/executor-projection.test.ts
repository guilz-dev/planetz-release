import { type AgentState, EXECUTOR_ID_CURSOR, type TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  executorsToAgentStates,
  projectExecutorsFromAttributions,
} from '../lib/projection/executor-projection.js'

const TEMPLATE_CURSOR: AgentState = {
  id: EXECUTOR_ID_CURSOR,
  displayName: 'Cursor (external)',
  runtime: 'external',
  role: 'custom',
  status: 'idle',
  logTail: [],
  updatedAt: '2026-05-27T00:00:00.000Z',
}

function runningTask(partial: Partial<TaskViewModel> & Pick<TaskViewModel, 'id'>): TaskViewModel {
  return {
    title: 'Task',
    status: 'running',
    priority: 'normal',
    source: 'takt',
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:01:00.000Z',
    ...partial,
  }
}

describe('projectExecutorsFromAttributions', () => {
  it('marks template executor working from task attribution', () => {
    const executors = projectExecutorsFromAttributions(
      [TEMPLATE_CURSOR],
      [
        runningTask({
          id: 't1',
          executorAttribution: {
            taskId: 't1',
            executorId: EXECUTOR_ID_CURSOR,
            source: 'explicit-assignment',
            confidence: 'high',
          },
        }),
      ],
    )
    const cursor = executors.find((e) => e.id === EXECUTOR_ID_CURSOR)
    expect(cursor?.status).toBe('working')
    expect(cursor?.activeTaskIds).toEqual(['t1'])
  })

  it('aggregates multiple running tasks on the same executor', () => {
    const executors = projectExecutorsFromAttributions(
      [TEMPLATE_CURSOR],
      [
        runningTask({
          id: 't1',
          executorAttribution: {
            taskId: 't1',
            executorId: EXECUTOR_ID_CURSOR,
            source: 'explicit-assignment',
            confidence: 'high',
          },
        }),
        runningTask({
          id: 't2',
          executorAttribution: {
            taskId: 't2',
            executorId: EXECUTOR_ID_CURSOR,
            source: 'explicit-assignment',
            confidence: 'high',
          },
        }),
      ],
    )
    const cursor = executors.find((e) => e.id === EXECUTOR_ID_CURSOR)
    expect(cursor?.activeTaskIds).toEqual(['t1', 't2'])
    expect(cursor?.status).toBe('working')
  })

  it('synthesizes orphan executor when template is missing', () => {
    const executors = projectExecutorsFromAttributions(
      [],
      [
        runningTask({
          id: 't1',
          executorAttribution: {
            taskId: 't1',
            executorId: 'agent-external-codex',
            source: 'profile-provider',
            confidence: 'medium',
          },
        }),
      ],
    )
    expect(executors).toHaveLength(1)
    expect(executors[0].id).toBe('agent-external-codex')
    expect(executors[0].status).toBe('working')
    expect(executors[0].displayName).toContain('Codex')
  })
})

describe('executorsToAgentStates', () => {
  it('maps executor fields onto agent-compatible shape', () => {
    const templateById = new Map([[TEMPLATE_CURSOR.id, TEMPLATE_CURSOR]])
    const agents = executorsToAgentStates(
      [
        {
          id: EXECUTOR_ID_CURSOR,
          displayName: TEMPLATE_CURSOR.displayName,
          runtime: 'external',
          status: 'working',
          activeTaskIds: ['t1'],
          activeRunIds: ['run-1'],
          updatedAt: '2026-05-27T10:00:00.000Z',
        },
      ],
      templateById,
    )
    expect(agents[0].status).toBe('working')
    expect(agents[0].currentTaskId).toBe('t1')
    expect(agents[0].currentRunId).toBe('run-1')
    expect(agents[0].role).toBe('custom')
  })
})
