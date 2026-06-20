import type { TaskViewModel } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSession } from '../app-session.js'
import type { TaskFailureDesktopNotifier } from '../lib/task-failure-desktop-notifier.js'
import { dispatchTaskFailureNotifications } from '../lib/task-failure-notification-dispatch.js'
import { TaskFailureNotificationTracker } from '../lib/task-failure-notification-tracker.js'

function task(
  id: string,
  status: TaskViewModel['status'],
  overrides: Partial<TaskViewModel> = {},
): TaskViewModel {
  return {
    id,
    title: id,
    priority: 'normal',
    status,
    source: 'takt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('dispatchTaskFailureNotifications', () => {
  const tracker = new TaskFailureNotificationTracker()
  let notify: ReturnType<typeof vi.fn>
  let notifier: TaskFailureDesktopNotifier
  let loadEffectiveEngineConfig: ReturnType<typeof vi.fn>
  let session: AppSession

  beforeEach(() => {
    tracker.reset()
    notify = vi.fn()
    notifier = { notify } as unknown as TaskFailureDesktopNotifier
    loadEffectiveEngineConfig = vi.fn(async () => ({ notification_sound: true }))
    session = {
      getState: () => ({ tasks: [task('t1', 'running')] }),
      taskFailureNotificationTracker: tracker,
      loadEffectiveEngineConfig,
    } as unknown as AppSession
  })

  it('does nothing when there is no state', () => {
    session = {
      getState: () => null,
      taskFailureNotificationTracker: tracker,
      loadEffectiveEngineConfig,
    } as unknown as AppSession

    dispatchTaskFailureNotifications(session, notifier)

    expect(notify).not.toHaveBeenCalled()
  })

  it('shows notifications after engine config resolves without blocking the caller', async () => {
    let configResolved = false
    loadEffectiveEngineConfig.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            configResolved = true
            resolve({ notification_sound: true })
          }, 20)
        }),
    )

    tracker.collectNewFailures([task('t1', 'running')])
    session = {
      getState: () => ({
        tasks: [task('t1', 'failed', { statusReason: 'workflow_aborted' })],
      }),
      taskFailureNotificationTracker: tracker,
      loadEffectiveEngineConfig,
    } as unknown as AppSession

    dispatchTaskFailureNotifications(session, notifier)

    expect(configResolved).toBe(false)
    expect(notify).not.toHaveBeenCalled()

    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledOnce()
    })
  })
})
