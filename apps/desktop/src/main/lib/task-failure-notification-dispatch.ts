import type { AppSession } from '../app-session.js'
import type { TaskFailureDesktopNotifier } from './task-failure-desktop-notifier.js'
import { shouldShowDesktopFailureNotification } from './task-failure-notification-policy.js'

/**
 * Detects new task failures synchronously, then shows desktop notifications asynchronously.
 * Does not block state broadcast — callers should invoke this before `broadcastNow()`.
 */
export function dispatchTaskFailureNotifications(
  session: AppSession,
  notifier: TaskFailureDesktopNotifier,
): void {
  const tasks = session.getState()?.tasks
  if (!tasks) return

  const payloads = session.taskFailureNotificationTracker.collectNewFailures(tasks)
  if (payloads.length === 0) return

  void (async () => {
    let engine = {}
    try {
      engine = await session.loadEffectiveEngineConfig()
    } catch {
      // Workspace may be closing; default to showing notifications.
    }
    for (const payload of payloads) {
      if (!shouldShowDesktopFailureNotification(engine, payload)) continue
      notifier.notify(payload)
    }
  })()
}
