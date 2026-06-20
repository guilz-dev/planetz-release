import type {
  RunEvent,
  TaskFailure,
  TaskFailureLogEntry,
  TaskStatus,
  TaskStatusReason,
} from '@planetz/shared'

/** Cap on warn/error log entries retained on TaskFailure.recentErrorLog. */
const MAX_FAILURE_LOG_ENTRIES = 5

function findLastIndex<T>(arr: readonly T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (pred(arr[i])) return i
  }
  return -1
}

function toFailureLogEntry(event: RunEvent): TaskFailureLogEntry | null {
  if (event.type !== 'log') return null
  if (event.level !== 'warn' && event.level !== 'error') return null
  const message = event.message?.trim()
  if (!message) return null
  return { at: event.at, level: event.level, message }
}

/**
 * Build a TaskFailure record from chronologically ordered events for a single task.
 * Returns undefined when the events are not sufficient to express a failure.
 */
export function deriveTaskFailure(
  events: readonly RunEvent[],
  kind: 'failed' | 'exceeded',
): TaskFailure | undefined {
  if (events.length === 0) return undefined

  const abortIdx = findLastIndex(events, (e) => e.type === 'workflow_abort')
  const abort = abortIdx >= 0 ? events[abortIdx] : undefined

  const lastStepStartIdx = findLastIndex(events, (e) => e.type === 'step_start')
  const lastStepCompleteIdx = findLastIndex(events, (e) => e.type === 'step_complete')
  const failedStep =
    lastStepStartIdx > lastStepCompleteIdx && events[lastStepStartIdx]?.message
      ? events[lastStepStartIdx].message
      : undefined

  const errorLogs: TaskFailureLogEntry[] = []
  for (const ev of events) {
    const entry = toFailureLogEntry(ev)
    if (entry) errorLogs.push(entry)
  }
  const recentErrorLog =
    errorLogs.length > 0 ? errorLogs.slice(-MAX_FAILURE_LOG_ENTRIES) : undefined

  const lastEvent = events[events.length - 1]
  const failedAt = abort?.at ?? errorLogs[errorLogs.length - 1]?.at ?? lastEvent.at
  if (!failedAt) return undefined

  return {
    failedAt,
    ...(failedStep ? { failedStep } : {}),
    ...(abort?.message ? { message: abort.message } : {}),
    ...((abort?.runId ?? lastEvent.runId) ? { runId: abort?.runId ?? lastEvent.runId } : {}),
    ...(recentErrorLog ? { recentErrorLog } : {}),
    kind,
  }
}

/**
 * Prefer tasks.yaml failure fields; enrich with run-event inference when missing.
 */
export function mergeTaskFailure(
  fromYaml: TaskFailure | undefined,
  fromEvents: TaskFailure | undefined,
): TaskFailure | undefined {
  if (!fromYaml && !fromEvents) return undefined
  if (!fromYaml) return fromEvents
  if (!fromEvents) return fromYaml
  return {
    kind: fromYaml.kind,
    failedAt: fromYaml.failedAt ?? fromEvents.failedAt,
    message: fromYaml.message ?? fromEvents.message,
    failedStep: fromYaml.failedStep ?? fromEvents.failedStep,
    runId: fromYaml.runId ?? fromEvents.runId,
    recentErrorLog: fromEvents.recentErrorLog ?? fromYaml.recentErrorLog,
  }
}

export interface ResolveTaskFailureInput {
  status: TaskStatus
  failure?: TaskFailure
  statusReason?: TaskStatusReason
  updatedAt: string
}

/**
 * Yaml-first failure merge, then run events; synthesize a minimal record when only statusReason exists.
 */
export function resolveTaskFailure(
  task: ResolveTaskFailureInput,
  fromEvents: TaskFailure | undefined,
): TaskFailure | undefined {
  const merged = mergeTaskFailure(task.failure, fromEvents)
  if (merged?.message?.trim() || merged?.failedStep || merged?.recentErrorLog?.length) {
    return merged
  }
  if (task.status !== 'failed' && task.status !== 'exceeded') return undefined
  if (task.statusReason) {
    return {
      failedAt: task.failure?.failedAt ?? task.updatedAt,
      kind: task.status,
      ...(merged?.runId ? { runId: merged.runId } : {}),
      ...(merged?.message ? { message: merged.message } : {}),
    }
  }
  return merged
}
