import type { ExecutorState, TaskStatus, TaskViewModel } from '@planetz/shared'

export type TaskLaneFilter = 'all' | 'active' | 'queue' | 'done' | 'error'

export const TASK_LANE_FILTER_MATCH: Record<TaskLaneFilter, (status: TaskStatus) => boolean> = {
  all: () => true,
  active: (s) => s === 'running',
  queue: (s) => s === 'pending' || s === 'stopped',
  done: (s) => s === 'completed',
  error: (s) => s === 'failed' || s === 'exceeded',
}

export function filterTasksForLane(
  tasks: TaskViewModel[],
  filter: TaskLaneFilter,
): TaskViewModel[] {
  return tasks.filter((t) => TASK_LANE_FILTER_MATCH[filter](t.status))
}

/** Whether a task is attributed to the given executor (active run or explicit assignment). */
export function taskMatchesExecutor(
  task: TaskViewModel,
  executorId: string,
  executor: ExecutorState | undefined,
): boolean {
  if (executor?.activeTaskIds.includes(task.id)) return true
  if (task.executorAttribution?.executorId === executorId) return true
  if (task.assignedAgentId === executorId) return true
  return false
}

export function filterTasksByExecutor(
  tasks: TaskViewModel[],
  executorId: string | undefined,
  executors: ExecutorState[],
): TaskViewModel[] {
  if (!executorId) return tasks
  const executor = executors.find((e) => e.id === executorId)
  if (!executor) return tasks
  return tasks.filter((t) => taskMatchesExecutor(t, executorId, executor))
}
