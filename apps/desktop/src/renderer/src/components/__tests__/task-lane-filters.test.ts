import type { ExecutorState, TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { filterTasksByExecutor, filterTasksForLane } from '../task-lane-filters.js'

function makeTask(status: TaskViewModel['status'], id: string): TaskViewModel {
  return {
    id,
    title: id,
    priority: 'normal',
    status,
    source: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('filterTasksForLane', () => {
  const tasks = [
    makeTask('pending', 'p1'),
    makeTask('running', 'r1'),
    makeTask('stopped', 's1'),
    makeTask('completed', 'c1'),
    makeTask('failed', 'f1'),
    makeTask('exceeded', 'e1'),
  ]

  it('done includes only completed tasks', () => {
    const ids = filterTasksForLane(tasks, 'done').map((t) => t.id)
    expect(ids).toEqual(['c1'])
  })

  it('error includes failed and exceeded tasks', () => {
    const ids = filterTasksForLane(tasks, 'error').map((t) => t.id)
    expect(ids).toEqual(['f1', 'e1'])
  })

  it('queue includes pending and stopped tasks', () => {
    const ids = filterTasksForLane(tasks, 'queue').map((t) => t.id)
    expect(ids).toEqual(['p1', 's1'])
  })
})

describe('filterTasksByExecutor', () => {
  const executors: ExecutorState[] = [
    {
      id: 'agent-external-cursor',
      displayName: 'Cursor',
      runtime: 'takt',
      status: 'working',
      activeTaskIds: ['r1'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]

  it('returns all tasks when no executor is selected', () => {
    const tasks = [makeTask('running', 'r1'), makeTask('pending', 'p1')]
    expect(filterTasksByExecutor(tasks, undefined, executors)).toHaveLength(2)
  })

  it('keeps tasks in activeTaskIds for the selected executor', () => {
    const tasks = [makeTask('running', 'r1'), makeTask('running', 'r2')]
    const ids = filterTasksByExecutor(tasks, 'agent-external-cursor', executors).map((t) => t.id)
    expect(ids).toEqual(['r1'])
  })

  it('toggles off when the same executor is selected again (caller state)', () => {
    let filterId: string | undefined = 'agent-external-cursor'
    const toggle = (id: string) => {
      filterId = filterId === id ? undefined : id
    }
    toggle('agent-external-cursor')
    expect(filterId).toBeUndefined()
  })
})
