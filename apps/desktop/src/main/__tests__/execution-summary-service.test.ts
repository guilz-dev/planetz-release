import type { ExecutorState, TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  computeExecutionSummary,
  resolveTaskAnalyticsAt,
} from '../planetz/execution-summary-service.js'

const NOW = Date.now()
const HOUR_MS = 60 * 60 * 1000

function isoHoursAgo(hours: number): string {
  return new Date(NOW - hours * HOUR_MS).toISOString()
}

const executors: ExecutorState[] = [
  {
    id: 'agent-coder',
    displayName: 'Coder',
    runtime: 'takt',
    status: 'idle',
    activeTaskIds: [],
    updatedAt: isoHoursAgo(0),
  },
]

describe('computeExecutionSummary', () => {
  it('counts only terminal tasks in the window and computes task success rate', () => {
    const tasks: TaskViewModel[] = [
      {
        id: 't1',
        title: 'Done',
        status: 'completed',
        priority: 'normal',
        source: 'user',
        workflow: 'default',
        createdAt: isoHoursAgo(10),
        updatedAt: isoHoursAgo(2),
        assignedAgentId: 'agent-coder',
      },
      {
        id: 't2',
        title: 'Fail',
        status: 'failed',
        priority: 'normal',
        source: 'user',
        workflow: 'default',
        createdAt: isoHoursAgo(10),
        updatedAt: isoHoursAgo(3),
        assignedAgentId: 'agent-coder',
      },
      {
        id: 't3',
        title: 'Exceeded',
        status: 'exceeded',
        priority: 'normal',
        source: 'user',
        workflow: 'review',
        createdAt: isoHoursAgo(10),
        updatedAt: isoHoursAgo(4),
      },
      {
        id: 't4',
        title: 'Running',
        status: 'running',
        priority: 'normal',
        source: 'user',
        createdAt: isoHoursAgo(1),
        updatedAt: isoHoursAgo(1),
      },
      {
        id: 't5',
        title: 'Old done',
        status: 'completed',
        priority: 'normal',
        source: 'user',
        createdAt: isoHoursAgo(500),
        updatedAt: isoHoursAgo(500),
      },
    ]

    const summary = computeExecutionSummary({ tasks, executors, window: '7d' })
    expect(summary.total).toBe(3)
    expect(summary.completed).toBe(1)
    expect(summary.failureCount).toBe(2)
    expect(summary.successRate).toBe(33.3)
    expect(summary.byWorkflow[0]?.workflow).toBe('default')
  })

  it('uses failure.failedAt when updatedAt is stale', () => {
    const tasks: TaskViewModel[] = [
      {
        id: 't-old',
        title: 'Failed recently',
        status: 'failed',
        priority: 'normal',
        source: 'user',
        createdAt: isoHoursAgo(500),
        updatedAt: isoHoursAgo(500),
        failure: {
          failedAt: isoHoursAgo(2),
          message: 'boom',
          kind: 'failed',
        },
      },
    ]
    const summary = computeExecutionSummary({ tasks, executors, window: '7d' })
    expect(summary.total).toBe(1)
    expect(resolveTaskAnalyticsAt(tasks[0]!)).toBe(isoHoursAgo(2))
  })

  it('returns zeros when no terminal tasks match', () => {
    const summary = computeExecutionSummary({
      tasks: [
        {
          id: 't1',
          title: 'Pending',
          status: 'pending',
          priority: 'normal',
          source: 'user',
          createdAt: isoHoursAgo(1),
          updatedAt: isoHoursAgo(1),
        },
      ],
      executors,
      window: '24h',
    })
    expect(summary.total).toBe(0)
    expect(summary.successRate).toBe(0)
    expect(summary.failureCount).toBe(0)
  })
})
