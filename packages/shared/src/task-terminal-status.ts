import type { TaskStatus } from './types.js'

const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['completed', 'failed', 'exceeded'])

/** Task has finished; do not project live run highlights (activeStep, etc.). */
export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.has(status)
}
