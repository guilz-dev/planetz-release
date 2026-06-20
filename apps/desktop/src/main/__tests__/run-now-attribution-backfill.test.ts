import type { TaskViewModel, UiState } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { tryBackfillRunNowAssignment } from '../lib/run-now-attribution-backfill.js'

const BASE_TASK: TaskViewModel = {
  id: 'task-1',
  title: 'Run feature',
  status: 'running',
  priority: 'normal',
  source: 'takt',
  workflow: 'default',
  createdAt: '2026-05-27T10:00:00.000Z',
  updatedAt: '2026-05-27T10:01:00.000Z',
}

describe('tryBackfillRunNowAssignment', () => {
  it('writes taskAssignments when exactly one matching running task exists', () => {
    const uiState: UiState = {}
    const result = tryBackfillRunNowAssignment(
      [BASE_TASK],
      {
        workflow: 'default',
        title: 'Run feature',
        executorId: 'agent-external-cursor',
        at: '2026-05-27T09:59:00.000Z',
      },
      uiState,
    )
    expect(result.taskAssignments).toEqual({ 'task-1': 'agent-external-cursor' })
    expect(result.matchedTaskId).toBe('task-1')
    expect(result.clearPending).toBe(true)
  })

  it('disambiguates by title when multiple running tasks share a workflow', () => {
    const second: TaskViewModel = {
      ...BASE_TASK,
      id: 'task-2',
      title: 'Other task',
      createdAt: '2026-05-27T10:00:30.000Z',
    }
    const result = tryBackfillRunNowAssignment(
      [BASE_TASK, second],
      {
        workflow: 'default',
        title: 'Run feature',
        executorId: 'agent-external-cursor',
        at: '2026-05-27T09:59:00.000Z',
      },
      {},
    )
    expect(result.taskAssignments).toEqual({ 'task-1': 'agent-external-cursor' })
    expect(result.clearPending).toBe(true)
  })

  it('does not write when multiple candidates match', () => {
    const second: TaskViewModel = {
      ...BASE_TASK,
      id: 'task-2',
      createdAt: '2026-05-27T10:00:30.000Z',
    }
    const result = tryBackfillRunNowAssignment(
      [BASE_TASK, second],
      {
        workflow: 'default',
        title: 'Run feature',
        executorId: 'agent-external-cursor',
        at: '2026-05-27T09:59:00.000Z',
      },
      {},
    )
    expect(result.taskAssignments).toBeUndefined()
    expect(result.clearPending).toBe(false)
  })

  it('clears pending without executorId', () => {
    const result = tryBackfillRunNowAssignment(
      [BASE_TASK],
      { workflow: 'default', title: 'Run feature', at: '2026-05-27T09:59:00.000Z' },
      {},
    )
    expect(result.taskAssignments).toBeUndefined()
    expect(result.clearPending).toBe(true)
  })
})
