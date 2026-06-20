import type { TaskViewModel } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { TaskFailureNotificationTracker } from '../lib/task-failure-notification-tracker.js'

function task(
  id: string,
  status: TaskViewModel['status'],
  overrides: Partial<TaskViewModel> = {},
): TaskViewModel {
  return {
    id,
    title: `Task ${id}`,
    priority: 'normal',
    status,
    source: 'takt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('TaskFailureNotificationTracker', () => {
  it('does not notify on first observation of an already-failed task', () => {
    const tracker = new TaskFailureNotificationTracker()
    const payloads = tracker.collectNewFailures([
      task('t1', 'failed', { statusReason: 'workflow_aborted' }),
    ])
    expect(payloads).toHaveLength(0)
  })

  it('notifies once when a task transitions from running to failed', () => {
    const tracker = new TaskFailureNotificationTracker()
    tracker.collectNewFailures([task('t1', 'running')])
    const payloads = tracker.collectNewFailures([
      task('t1', 'failed', {
        statusReason: 'workflow_aborted',
        failure: { kind: 'failed', failedAt: '2026-01-02T00:00:00.000Z', message: 'Step failed' },
      }),
    ])
    expect(payloads).toHaveLength(1)
    expect(payloads[0]?.taskId).toBe('t1')
    expect(payloads[0]?.message).toBe('Step failed')
    expect(payloads[0]?.statusReason).toBe('workflow_aborted')
  })

  it('does not notify again on subsequent refresh while still failed', () => {
    const tracker = new TaskFailureNotificationTracker()
    tracker.collectNewFailures([task('t1', 'running')])
    tracker.collectNewFailures([task('t1', 'failed')])
    const again = tracker.collectNewFailures([task('t1', 'failed')])
    expect(again).toHaveLength(0)
  })

  it('notifies when transitioning from pending to failed', () => {
    const tracker = new TaskFailureNotificationTracker()
    tracker.collectNewFailures([task('t1', 'pending')])
    const payloads = tracker.collectNewFailures([task('t1', 'failed')])
    expect(payloads).toHaveLength(1)
  })

  it('does not notify when transitioning from completed to failed', () => {
    const tracker = new TaskFailureNotificationTracker()
    tracker.collectNewFailures([task('t1', 'completed')])
    const payloads = tracker.collectNewFailures([task('t1', 'failed')])
    expect(payloads).toHaveLength(0)
  })

  it('notifies when a task transitions from running to exceeded', () => {
    const tracker = new TaskFailureNotificationTracker()
    tracker.collectNewFailures([task('t1', 'running')])
    const payloads = tracker.collectNewFailures([
      task('t1', 'exceeded', { statusReason: 'iteration_exceeded' }),
    ])
    expect(payloads).toHaveLength(1)
    expect(payloads[0]?.statusReason).toBe('iteration_exceeded')
  })

  it('reset clears previous statuses', () => {
    const tracker = new TaskFailureNotificationTracker()
    tracker.collectNewFailures([task('t1', 'running')])
    tracker.reset()
    const payloads = tracker.collectNewFailures([task('t1', 'failed')])
    expect(payloads).toHaveLength(0)
  })
})
