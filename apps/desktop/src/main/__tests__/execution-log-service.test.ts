import type { ExecutorState, RunEvent, TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { listExecutionLog } from '../planetz/execution-log-service.js'

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

const tasks: TaskViewModel[] = [
  {
    id: 'task-a',
    title: 'Auth feature',
    status: 'running',
    priority: 'normal',
    source: 'user',
    createdAt: isoHoursAgo(48),
    updatedAt: isoHoursAgo(1),
    assignedAgentId: 'agent-coder',
  },
  {
    id: 'task-b',
    title: 'Old failure',
    status: 'failed',
    priority: 'normal',
    source: 'user',
    createdAt: isoHoursAgo(200),
    updatedAt: isoHoursAgo(200),
  },
]

const runEvents: RunEvent[] = [
  {
    runId: 'run-a:session-1',
    runDirSlug: 'run-a',
    sessionId: 'session-1',
    taskId: 'task-a',
    type: 'step_start',
    at: isoHoursAgo(2),
    message: 'implement',
  },
  {
    runId: 'run-a:session-1',
    runDirSlug: 'run-a',
    sessionId: 'session-1',
    taskId: 'task-a',
    type: 'log',
    at: isoHoursAgo(1),
    message: 'lint passed',
    level: 'info',
  },
  {
    runId: 'run-old:session-9',
    runDirSlug: 'run-old',
    sessionId: 'session-9',
    taskId: 'task-b',
    type: 'workflow_abort',
    at: isoHoursAgo(200),
    message: 'timeout',
  },
]

describe('listExecutionLog', () => {
  it('defaults to planetz events in the last 7d, newest first', () => {
    const result = listExecutionLog({ runEvents, tasks, executors })
    expect(result.total).toBe(2)
    expect(result.records[0]?.eventType).toBe('log')
    expect(result.records[0]?.executorName).toBe('Coder')
    expect(result.records.every((r) => r.source === 'planetz')).toBe(true)
  })

  it('filters by keyword and event type', () => {
    const result = listExecutionLog({
      runEvents,
      tasks,
      executors,
      query: { keyword: 'implement', eventType: 'step_start', window: 'all' },
    })
    expect(result.total).toBe(1)
    expect(result.records[0]?.message).toBe('implement')
  })

  it('filters by task status', () => {
    const result = listExecutionLog({
      runEvents,
      tasks,
      executors,
      query: { taskStatus: 'failed', window: 'all' },
    })
    expect(result.total).toBe(1)
    expect(result.records[0]?.taskId).toBe('task-b')
  })

  it('exposes rawTotalInWindow before non-window filters', () => {
    const result = listExecutionLog({
      runEvents,
      tasks,
      executors,
      query: { keyword: 'no-match', window: '7d' },
    })
    expect(result.rawTotalInWindow).toBe(2)
    expect(result.total).toBe(0)
  })

  it('filters by exact runId', () => {
    const result = listExecutionLog({
      runEvents,
      tasks,
      executors,
      query: { runId: 'run-a:session-1', window: 'all' },
    })
    expect(result.total).toBe(2)
    expect(result.records.every((r) => r.runId === 'run-a:session-1')).toBe(true)
  })

  it('adds fallback failure records when failed tasks have no run events', () => {
    const failedWithoutRuns: TaskViewModel = {
      id: 'task-c',
      title: 'Run now setup error',
      status: 'failed',
      priority: 'normal',
      source: 'user',
      createdAt: isoHoursAgo(6),
      updatedAt: isoHoursAgo(5),
      assignedAgentId: 'agent-coder',
      failure: {
        failedAt: isoHoursAgo(5),
        message: 'Invalid base branch: HEAD',
        runId: '20260527-101738-issue-15:task-state',
        kind: 'failed',
      },
    }
    const result = listExecutionLog({
      runEvents: [],
      tasks: [failedWithoutRuns],
      executors,
      query: { window: 'all' },
    })
    expect(result.total).toBe(1)
    expect(result.rawTotalInWindow).toBe(1)
    expect(result.records[0]?.eventType).toBe('workflow_abort')
    expect(result.records[0]?.runId).toBe('20260527-101738-issue-15:task-state')
    expect(result.records[0]?.message).toBe('Invalid base branch: HEAD')
    expect(result.records[0]?.executorName).toBe('Coder')
  })

  it('does not duplicate fallback failure records when run events exist', () => {
    const taskWithRunEvents: TaskViewModel = {
      id: 'task-c',
      title: 'Run now setup error',
      status: 'failed',
      priority: 'normal',
      source: 'user',
      createdAt: isoHoursAgo(6),
      updatedAt: isoHoursAgo(5),
      assignedAgentId: 'agent-coder',
      failure: {
        failedAt: isoHoursAgo(5),
        message: 'Invalid base branch: HEAD',
        runId: '20260527-101738-issue-15:task-state',
        kind: 'failed',
      },
    }
    const result = listExecutionLog({
      runEvents: [
        {
          runId: 'run-c:session-1',
          runDirSlug: 'run-c',
          sessionId: 'session-1',
          taskId: 'task-c',
          type: 'log',
          at: isoHoursAgo(4),
          message: 'workflow started',
          level: 'info',
        },
      ],
      tasks: [taskWithRunEvents],
      executors,
      query: { window: 'all' },
    })
    expect(result.total).toBe(1)
    expect(result.rawTotalInWindow).toBe(1)
    expect(result.records[0]?.eventType).toBe('log')
    expect(result.records[0]?.runId).toBe('run-c:session-1')
  })

  it('paginates with cursor without duplicates', () => {
    const manyEvents: RunEvent[] = []
    for (let i = 0; i < 5; i += 1) {
      manyEvents.push({
        runId: 'run-page:session-1',
        runDirSlug: 'run-page',
        sessionId: 'session-1',
        taskId: 'task-a',
        type: 'log',
        at: new Date(NOW - i * 1000).toISOString(),
        message: `line-${i}`,
        level: 'info',
      })
    }
    const first = listExecutionLog({
      runEvents: manyEvents,
      tasks,
      executors,
      query: { window: 'all', limit: 2 },
    })
    expect(first.hasMore).toBe(true)
    expect(first.records).toHaveLength(2)
    expect(first.nextCursor).toBeTruthy()

    const second = listExecutionLog({
      runEvents: manyEvents,
      tasks,
      executors,
      query: { window: 'all', limit: 2, cursor: first.nextCursor },
    })
    expect(second.records).toHaveLength(2)
    const ids = new Set([...first.records, ...second.records].map((r) => r.id))
    expect(ids.size).toBe(4)
    expect(second.hasMore).toBe(true)

    const third = listExecutionLog({
      runEvents: manyEvents,
      tasks,
      executors,
      query: { window: 'all', limit: 2, cursor: second.nextCursor },
    })
    expect(third.records).toHaveLength(1)
    expect(third.hasMore).toBe(false)
  })

  it('includes step_complete content in log message', () => {
    const events: RunEvent[] = [
      {
        runId: 'run-a:session-1',
        runDirSlug: 'run-a',
        sessionId: 'session-1',
        taskId: 'task-a',
        type: 'step_complete',
        at: isoHoursAgo(1),
        message: 'implement',
        content: 'Generated test file contents.',
      },
    ]
    const result = listExecutionLog({
      runEvents: events,
      tasks,
      executors,
      query: { window: 'all' },
    })
    expect(result.records[0]?.message).toContain('Generated test file contents.')
    expect(result.records[0]?.message).toContain('implement')
  })

  it('uses stable record ids', () => {
    const result = listExecutionLog({ runEvents, tasks, executors, query: { window: 'all' } })
    const record = result.records.find((r) => r.eventType === 'log')
    expect(record?.id).toBe(`run-a:session-1:${record?.at}:log`)
  })

  it('assigns unique ids when multiple logs share run, time, and type', () => {
    const at = isoHoursAgo(1)
    const dupEvents: RunEvent[] = [
      {
        runId: 'run-a:session-1',
        runDirSlug: 'run-a',
        sessionId: 'session-1',
        taskId: 'task-a',
        type: 'log',
        at,
        message: 'line-a',
        level: 'info',
      },
      {
        runId: 'run-a:session-1',
        runDirSlug: 'run-a',
        sessionId: 'session-1',
        taskId: 'task-a',
        type: 'log',
        at,
        message: 'line-b',
        level: 'info',
      },
    ]
    const result = listExecutionLog({
      runEvents: dupEvents,
      tasks,
      executors,
      query: { window: 'all' },
    })
    const ids = result.records.map((r) => r.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids.some((id) => /~1$/.test(id))).toBe(true)
  })
})
