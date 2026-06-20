import {
  stepActivityToTaskExecutionEntry,
  TASK_LIVE_ACTIVITY_CAP,
  type TaskExecutionActivityEntry,
  type TaskViewModel,
} from '@planetz/shared'

/** Task-level live feed: prefer projected `liveActivity`, else flatten workflow step histories. */
export function resolveTaskLiveActivityFeed(task: TaskViewModel): TaskExecutionActivityEntry[] {
  if (task.liveActivity && task.liveActivity.length > 0) {
    return task.liveActivity
  }
  const stepViews = task.workflowStepActivities
  if (!stepViews?.length) return []

  const entries: TaskExecutionActivityEntry[] = []
  for (const view of stepViews) {
    for (const entry of view.history) {
      entries.push(stepActivityToTaskExecutionEntry(entry, view.stepName))
    }
  }
  entries.sort((a, b) => a.at.localeCompare(b.at))
  if (entries.length <= TASK_LIVE_ACTIVITY_CAP) return entries
  return entries.slice(entries.length - TASK_LIVE_ACTIVITY_CAP)
}
