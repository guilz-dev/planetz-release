import type { EngineConfig } from '@planetz/shared'
import type { TaskFailureNotificationPayload } from './task-failure-notification-tracker.js'

function notificationSoundEvents(engine: EngineConfig): Record<string, boolean | undefined> | null {
  const raw = (engine as Record<string, unknown>).notification_sound_events
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Record<string, boolean | undefined>
}

/** Whether Planetz should show a desktop notification for this failure payload. */
export function shouldShowDesktopFailureNotification(
  engine: EngineConfig,
  payload: TaskFailureNotificationPayload,
): boolean {
  if ((engine as Record<string, unknown>).notification_sound === false) return false

  const events = notificationSoundEvents(engine)
  if (!events) return true

  if (payload.statusReason === 'workflow_aborted' && events.workflow_abort === false) {
    return false
  }
  if (payload.statusReason === 'iteration_exceeded' && events.iteration_limit === false) {
    return false
  }

  return true
}
