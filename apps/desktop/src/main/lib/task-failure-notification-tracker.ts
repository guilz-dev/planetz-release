import type { TaskStatus, TaskStatusReason, TaskViewModel } from '@planetz/shared'

const ACTIVE_STATUSES = new Set<TaskStatus>(['pending', 'running', 'stopped'])
const TERMINAL_FAILURE_STATUSES = new Set<TaskStatus>(['failed', 'exceeded'])

export interface TaskFailureNotificationPayload {
  taskId: string
  title: string
  message: string
  statusReason?: TaskStatusReason
}

function buildFailureMessage(task: TaskViewModel): string {
  const fromFailure = task.failure?.message?.trim()
  if (fromFailure) return fromFailure
  if (task.statusReason) return task.statusReason
  return task.title
}

/**
 * Detects transitions into terminal failure and yields notification payloads once per transition.
 */
export class TaskFailureNotificationTracker {
  private readonly previousStatuses = new Map<string, TaskStatus>()

  /**
   * Returns payloads for tasks that newly entered `failed` or `exceeded` from an active status.
   * Skips first observation (`prev === undefined`) to avoid notifying on workspace open.
   */
  collectNewFailures(tasks: TaskViewModel[]): TaskFailureNotificationPayload[] {
    const payloads: TaskFailureNotificationPayload[] = []

    for (const task of tasks) {
      const prev = this.previousStatuses.get(task.id)
      const becameFailed =
        TERMINAL_FAILURE_STATUSES.has(task.status) &&
        prev !== undefined &&
        !TERMINAL_FAILURE_STATUSES.has(prev) &&
        ACTIVE_STATUSES.has(prev)

      if (becameFailed) {
        payloads.push({
          taskId: task.id,
          title: task.title,
          message: buildFailureMessage(task),
          statusReason: task.statusReason,
        })
      }

      this.previousStatuses.set(task.id, task.status)
    }

    const currentIds = new Set(tasks.map((t) => t.id))
    for (const taskId of this.previousStatuses.keys()) {
      if (!currentIds.has(taskId)) {
        this.previousStatuses.delete(taskId)
      }
    }

    return payloads
  }

  reset(): void {
    this.previousStatuses.clear()
  }
}
