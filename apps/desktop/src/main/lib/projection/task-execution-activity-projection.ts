import {
  stepActivityToTaskExecutionEntry,
  TASK_LIVE_ACTIVITY_CAP,
  type TaskExecutionActivityEntry,
  type WorkflowStepActivityView,
} from '@planetz/shared'
import type { RunTraceEvent } from '../run-trace-types.js'
import { traceToTaskExecutionEntry } from './trace-event-to-activity.js'

export function projectTaskLiveActivity(traces: RunTraceEvent[]): TaskExecutionActivityEntry[] {
  const entries: TaskExecutionActivityEntry[] = []
  for (const ev of traces) {
    const entry = traceToTaskExecutionEntry(ev)
    if (entry) entries.push(entry)
  }
  return capTaskLiveActivity(entries)
}

/** When trace projection is empty, reuse per-step activity already grouped for WorkflowStepList. */
export function projectTaskLiveActivityFromStepViews(
  stepViews: WorkflowStepActivityView[],
): TaskExecutionActivityEntry[] {
  const entries: TaskExecutionActivityEntry[] = []
  for (const view of stepViews) {
    for (const stepEntry of view.history) {
      entries.push(stepActivityToTaskExecutionEntry(stepEntry, view.stepName))
    }
  }
  entries.sort((a, b) => a.at.localeCompare(b.at))
  return capTaskLiveActivity(entries)
}

export function mergeTaskLiveActivityProjection(
  traces: RunTraceEvent[],
  stepViews: WorkflowStepActivityView[] | undefined,
): TaskExecutionActivityEntry[] {
  const fromTraces = projectTaskLiveActivity(traces)
  if (fromTraces.length > 0) return fromTraces
  if (!stepViews?.length) return []
  return projectTaskLiveActivityFromStepViews(stepViews)
}

function capTaskLiveActivity(entries: TaskExecutionActivityEntry[]): TaskExecutionActivityEntry[] {
  if (entries.length <= TASK_LIVE_ACTIVITY_CAP) return entries
  return entries.slice(entries.length - TASK_LIVE_ACTIVITY_CAP)
}
