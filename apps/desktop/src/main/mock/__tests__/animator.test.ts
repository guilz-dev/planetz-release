import type { TaskViewModel } from '@planetz/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveActiveStepFromRunEvents } from '../../lib/run-events-parser.js'
import { tickMockTasks } from '../animator.js'
import { collectMockRunEvents, getMockRunSeeds, resetMockRunSeeds } from '../run-events-mock.js'

const STEP_NAMES = new Map<string, readonly string[]>([
  ['default', ['plan', 'implement', 'review']],
])

function makePending(id: string): TaskViewModel {
  const now = new Date().toISOString()
  return {
    id,
    title: id,
    priority: 'normal',
    status: 'pending',
    source: 'user',
    workflow: 'default',
    createdAt: now,
    updatedAt: now,
  }
}

describe('tickMockTasks', () => {
  beforeEach(() => {
    resetMockRunSeeds()
  })

  it('promotes pending to running and starts on the first workflow step', () => {
    const tasks = [makePending('task-a')]
    const afterFirst = tickMockTasks(tasks, { stepNamesByWorkflow: STEP_NAMES })
    expect(afterFirst[0].status).toBe('running')

    const events = collectMockRunEvents().filter((e) => e.taskId === 'task-a')
    const activeStep = resolveActiveStepFromRunEvents(events, ['plan', 'implement', 'review'])
    expect(activeStep).toBe('plan')
    expect(getMockRunSeeds().some((s) => s.taskId === 'task-a')).toBe(true)
  })

  it('advances the step on a subsequent tick without skipping the first step', () => {
    const tasks = [makePending('task-b')]
    tickMockTasks(tasks, { stepNamesByWorkflow: STEP_NAMES })
    const afterSecond = tickMockTasks([{ ...tasks[0], status: 'running' as const, id: 'task-b' }], {
      stepNamesByWorkflow: STEP_NAMES,
    })
    expect(afterSecond[0].status).toBe('running')
    const events = collectMockRunEvents().filter((e) => e.taskId === 'task-b')
    const activeStep = resolveActiveStepFromRunEvents(events, ['plan', 'implement', 'review'])
    expect(activeStep).toBe('implement')
  })

  it('does not auto-promote pending while any task is stopped', () => {
    const now = new Date().toISOString()
    const tasks: TaskViewModel[] = [
      {
        id: 'stopped-1',
        title: 'stopped',
        priority: 'normal',
        status: 'stopped',
        source: 'user',
        createdAt: now,
        updatedAt: now,
      },
      makePending('pending-1'),
    ]
    const next = tickMockTasks(tasks)
    expect(next.find((t) => t.id === 'pending-1')?.status).toBe('pending')
    expect(next.find((t) => t.id === 'stopped-1')?.status).toBe('stopped')
  })

  it('ticks updatedAt for an existing running task without workflow map', () => {
    const now = new Date().toISOString()
    const tasks: TaskViewModel[] = [
      {
        id: 'r1',
        title: 'r1',
        priority: 'normal',
        status: 'running',
        source: 'user',
        createdAt: now,
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    ]
    const next = tickMockTasks(tasks)
    expect(next[0].updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })
})
