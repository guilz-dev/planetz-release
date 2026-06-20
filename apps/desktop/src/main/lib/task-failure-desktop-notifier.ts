import { PRODUCT_DISPLAY_NAME } from '@planetz/shared'
import { Notification } from 'electron'
import type { TaskFailureNotificationPayload } from './task-failure-notification-tracker.js'

export type TaskFailureNotificationClickHandler = (taskId: string) => void

/**
 * Shows Electron native notifications for task failures with a click handler.
 */
export class TaskFailureDesktopNotifier {
  constructor(private readonly onClick: TaskFailureNotificationClickHandler) {}

  notify(payload: TaskFailureNotificationPayload): void {
    if (!Notification.isSupported()) return

    const notification = new Notification({
      title: PRODUCT_DISPLAY_NAME,
      body: `${payload.title}: ${payload.message}`,
      silent: false,
    })

    notification.on('click', () => {
      this.onClick(payload.taskId)
    })

    notification.show()
  }
}
