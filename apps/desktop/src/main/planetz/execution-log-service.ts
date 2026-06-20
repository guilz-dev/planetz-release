import {
  type ExecutionLogListResult,
  type ExecutionLogQuery,
  type ExecutionLogRecord,
  type ExecutorState,
  formatRunEventDisplayMessage,
  type RunEvent,
  type TaskViewModel,
} from '@planetz/shared'
import { isWithinAnalyticsWindow } from './analytics-window.js'
import {
  assignStableLogRecordIds,
  decodeLogCursor,
  encodeLogCursor,
  isLogRecordBeforeCursor,
} from './execution-log-cursor.js'

export const DEFAULT_LOG_LIMIT = 500

function resolveExecutor(
  task: TaskViewModel | undefined,
  executors: ExecutorState[],
): { executorId?: string; executorName?: string } {
  const executorId = task?.executorAttribution?.executorId ?? task?.assignedAgentId ?? undefined
  if (!executorId) return {}
  const executor = executors.find((e) => e.id === executorId)
  return {
    executorId,
    executorName: executor?.displayName ?? executorId,
  }
}

function buildLogRecord(
  event: RunEvent,
  task: TaskViewModel | undefined,
  executors: ExecutorState[],
  id: string,
): ExecutionLogRecord {
  const { executorId, executorName } = resolveExecutor(task, executors)
  return {
    id,
    at: event.at,
    taskId: event.taskId,
    taskTitle: task?.title,
    runId: event.runId,
    executorId,
    executorName,
    source: 'planetz',
    eventType: event.type,
    level: event.level,
    message: formatRunEventDisplayMessage(event) ?? event.message,
    taskStatus: task?.status,
  }
}

function buildTaskFailureFallbackRecord(
  task: TaskViewModel,
  executors: ExecutorState[],
): ExecutionLogRecord | null {
  if ((task.status !== 'failed' && task.status !== 'exceeded') || !task.failure?.message) {
    return null
  }
  const at = task.failure.failedAt || task.updatedAt
  const { executorId, executorName } = resolveExecutor(task, executors)
  return {
    id: `task-failure:${task.id}:${at}`,
    at,
    taskId: task.id,
    taskTitle: task.title,
    runId: task.failure.runId ?? `task-failure:${task.id}`,
    executorId,
    executorName,
    source: 'planetz',
    eventType: 'workflow_abort',
    message: task.failure.message,
    taskStatus: task.status,
  }
}

function matchesKeyword(record: ExecutionLogRecord, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    record.taskTitle,
    record.taskId,
    record.runId,
    record.executorName,
    record.message,
    record.eventType,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function compareLogRecordsDesc(a: ExecutionLogRecord, b: ExecutionLogRecord): number {
  const atCmp = b.at.localeCompare(a.at)
  if (atCmp !== 0) return atCmp
  return b.id.localeCompare(a.id)
}

export function listExecutionLog(input: {
  runEvents: RunEvent[]
  tasks: TaskViewModel[]
  executors: ExecutorState[]
  query?: ExecutionLogQuery
}): ExecutionLogListResult {
  const query = input.query ?? {}
  const window = query.window ?? '7d'
  const eventType = query.eventType ?? 'all'
  const taskStatus = query.taskStatus ?? 'all'
  const executorId = query.executorId ?? 'all'
  const runId = query.runId
  const limit = query.limit ?? DEFAULT_LOG_LIMIT

  const taskById = new Map(input.tasks.map((t) => [t.id, t]))
  const taskIdsWithRunEvents = new Set(
    input.runEvents
      .map((event) => event.taskId)
      .filter((taskId): taskId is string => typeof taskId === 'string' && taskId.length > 0),
  )

  const inWindow = input.runEvents.filter((event) => isWithinAnalyticsWindow(event.at, window))
  const stableIds = assignStableLogRecordIds(inWindow)
  const inWindowRunRecords = inWindow.map((event, index) => {
    const task = event.taskId ? taskById.get(event.taskId) : undefined
    return buildLogRecord(event, task, input.executors, stableIds[index] as string)
  })
  const inWindowFallbackRecords = input.tasks
    .filter((task) => !taskIdsWithRunEvents.has(task.id))
    .map((task) => buildTaskFailureFallbackRecord(task, input.executors))
    .filter(
      (record): record is ExecutionLogRecord =>
        record !== null && isWithinAnalyticsWindow(record.at, window),
    )
  const inWindowRecords = [...inWindowRunRecords, ...inWindowFallbackRecords]
  const rawTotalInWindow = inWindowRecords.length

  const filtered = inWindowRecords
    .filter((record) => {
      if (runId && record.runId !== runId) return false
      if (eventType !== 'all' && record.eventType !== eventType) return false
      if (taskStatus !== 'all' && record.taskStatus !== taskStatus) return false
      if (executorId !== 'all' && record.executorId !== executorId) return false
      if (!matchesKeyword(record, query.keyword ?? '')) return false
      return true
    })
    .sort(compareLogRecordsDesc)

  const total = filtered.length

  let pageSource = filtered
  if (query.cursor) {
    const cursor = decodeLogCursor(query.cursor)
    pageSource = filtered.filter((record) => isLogRecordBeforeCursor(record, cursor))
  }

  const page = pageSource.slice(0, limit)
  const hasMore = pageSource.length > limit
  const lastRecord = page.at(-1)
  const nextCursor =
    hasMore && lastRecord ? encodeLogCursor({ at: lastRecord.at, id: lastRecord.id }) : undefined

  return {
    records: page,
    total,
    truncated: hasMore,
    rawTotalInWindow,
    hasMore,
    nextCursor,
  }
}
