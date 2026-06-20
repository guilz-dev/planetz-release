import { describe, expect, it } from 'vitest'
import { shouldShowDesktopFailureNotification } from '../lib/task-failure-notification-policy.js'

describe('shouldShowDesktopFailureNotification', () => {
  const payload = {
    taskId: 't1',
    title: 'Task',
    message: 'failed',
    statusReason: 'workflow_aborted' as const,
  }

  it('returns false when notification_sound is false', () => {
    expect(shouldShowDesktopFailureNotification({ notification_sound: false }, payload)).toBe(false)
  })

  it('returns true when notification_sound is unset', () => {
    expect(shouldShowDesktopFailureNotification({}, payload)).toBe(true)
  })

  it('returns false when workflow_abort event is disabled', () => {
    expect(
      shouldShowDesktopFailureNotification(
        { notification_sound_events: { workflow_abort: false } },
        payload,
      ),
    ).toBe(false)
  })

  it('returns false for iteration_exceeded when iteration_limit event is disabled', () => {
    expect(
      shouldShowDesktopFailureNotification(
        { notification_sound_events: { iteration_limit: false } },
        { ...payload, statusReason: 'iteration_exceeded' },
      ),
    ).toBe(false)
  })
})
