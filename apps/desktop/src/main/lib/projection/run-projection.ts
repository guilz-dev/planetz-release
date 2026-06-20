import type { RunEvent } from '@planetz/shared'
import { resolveActiveStepFromRunEvents } from '../run-events-parser.js'
import type { RunTraceEvent } from '../run-trace-types.js'

interface RunScoped {
  runId: string
  at: string
  taskId?: string
}

function indexByTaskId<T extends RunScoped>(items: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const ev of items) {
    const tid = ev.taskId
    if (!tid) continue
    const bucket = map.get(tid)
    if (bucket) bucket.push(ev)
    else map.set(tid, [ev])
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.at.localeCompare(b.at))
  }
  return map
}

export function indexRunTracesByTaskId(runTraces: RunTraceEvent[]): Map<string, RunTraceEvent[]> {
  return indexByTaskId(runTraces)
}

export function indexRunEventsByTaskId(runEvents: RunEvent[]): Map<string, RunEvent[]> {
  return indexByTaskId(runEvents)
}

function lastRunIdFromTaskBucket<T extends RunScoped>(byTask: readonly T[]): string | undefined {
  if (byTask.length === 0) return undefined
  return byTask[byTask.length - 1]?.runId
}

/** Latest activity for this task: `runId` of the chronologically last event in `byTask`. */
export function lastRunIdFromTaskEvents(byTask: RunEvent[]): string | undefined {
  return lastRunIdFromTaskBucket(byTask)
}

function resolveActiveRunId<T extends RunScoped>(
  byTask: readonly T[],
  pinnedRunId: string | undefined,
): string | undefined {
  const fallbackRunId = lastRunIdFromTaskBucket(byTask)
  if (pinnedRunId !== undefined && byTask.some((e) => e.runId === pinnedRunId)) {
    return pinnedRunId
  }
  return fallbackRunId
}

/**
 * Resolve which run drives step highlight for a task.
 * Honors `pinnedRunId` only when that run still has events in `byTask`.
 */
export function resolveActiveRunIdForTask(
  byTask: RunEvent[],
  pinnedRunId: string | undefined,
): string | undefined {
  return resolveActiveRunId(byTask, pinnedRunId)
}

/** Latest activity for this task: `runId` of the chronologically last trace in `byTask`. */
export function lastRunIdFromTaskTraces(byTask: RunTraceEvent[]): string | undefined {
  return lastRunIdFromTaskBucket(byTask)
}

export function resolveActiveRunIdForTraces(
  byTask: RunTraceEvent[],
  pinnedRunId: string | undefined,
): string | undefined {
  return resolveActiveRunId(byTask, pinnedRunId)
}

/** Trace events for one task, scoped to the active run when resolvable. */
export function runTracesForTaskHighlight(
  byTask: RunTraceEvent[],
  pinnedRunId: string | undefined,
): RunTraceEvent[] {
  const activeRunId = resolveActiveRunIdForTraces(byTask, pinnedRunId)
  return activeRunId ? byTask.filter((e) => e.runId === activeRunId) : byTask
}

export function projectTaskRunHighlight(
  byTask: RunEvent[],
  pinnedRunId: string | undefined,
  workflowStepNames: string[],
): { activeRunId: string | undefined; activeStep: string | undefined } {
  const activeRunId = resolveActiveRunIdForTask(byTask, pinnedRunId)
  const runScoped =
    activeRunId !== undefined ? byTask.filter((e) => e.runId === activeRunId) : byTask
  const activeStep = resolveActiveStepFromRunEvents(runScoped, workflowStepNames)
  return { activeRunId, activeStep }
}

export function shallowStringRecordEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((k) => a[k] === b[k])
}
