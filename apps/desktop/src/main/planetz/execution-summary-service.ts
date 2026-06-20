import type {
  ExecutionAnalyticsWindow,
  ExecutionSummary,
  ExecutionSummaryExecutorBreakdown,
  ExecutionSummaryStatusBreakdown,
  ExecutionSummaryWorkflowBreakdown,
  ExecutorState,
  TaskStatus,
  TaskViewModel,
} from '@planetz/shared'
import { coerceIsoTimestamp, parseAnalyticsInstant } from './analytics-timestamp.js'
import { isWithinAnalyticsWindow } from './analytics-window.js'

const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set(['completed', 'failed', 'exceeded'])

/** Best-effort instant for terminal task analytics (window filter + breakdowns). */
export function resolveTaskAnalyticsAt(task: TaskViewModel): string {
  const fallback = coerceIsoTimestamp(task.createdAt, new Date(0).toISOString())
  const candidates: unknown[] = [task.failure?.failedAt, task.updatedAt, task.createdAt]
  for (const candidate of candidates) {
    const iso = coerceIsoTimestamp(candidate, '')
    if (iso && parseAnalyticsInstant(iso) !== null) return iso
  }
  return fallback
}

const TOP_WORKFLOW_BREAKDOWN = 8

function roundSuccessRate(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 1000) / 10
}

function resolveExecutorName(
  task: TaskViewModel,
  executors: ExecutorState[],
): { executorId: string; executorName: string } {
  const executorId = task.executorAttribution?.executorId ?? task.assignedAgentId ?? 'unknown'
  const executor = executors.find((e) => e.id === executorId)
  return {
    executorId,
    executorName: executor?.displayName ?? executorId,
  }
}

export function computeExecutionSummary(input: {
  tasks: TaskViewModel[]
  executors: ExecutorState[]
  window?: ExecutionAnalyticsWindow
}): ExecutionSummary {
  const window = input.window ?? '7d'
  const terminal = input.tasks.filter(
    (task) =>
      TERMINAL_STATUSES.has(task.status) &&
      isWithinAnalyticsWindow(resolveTaskAnalyticsAt(task), window),
  )

  const completed = terminal.filter((t) => t.status === 'completed').length
  const failed = terminal.filter((t) => t.status === 'failed').length
  const exceeded = terminal.filter((t) => t.status === 'exceeded').length
  const total = completed + failed + exceeded
  const failureCount = failed + exceeded

  const statusCounts = new Map<TaskStatus, number>()
  for (const task of terminal) {
    statusCounts.set(task.status, (statusCounts.get(task.status) ?? 0) + 1)
  }
  const byStatus: ExecutionSummaryStatusBreakdown[] = (
    ['completed', 'failed', 'exceeded'] as const
  ).map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }))

  const executorCounts = new Map<string, ExecutionSummaryExecutorBreakdown>()
  for (const task of terminal) {
    const { executorId, executorName } = resolveExecutorName(task, input.executors)
    const existing = executorCounts.get(executorId)
    if (existing) {
      existing.count += 1
    } else {
      executorCounts.set(executorId, { executorId, executorName, count: 1 })
    }
  }
  const byExecutor = [...executorCounts.values()].sort((a, b) => b.count - a.count)

  const workflowCounts = new Map<string, number>()
  for (const task of terminal) {
    const key = task.workflow?.trim() || '(none)'
    workflowCounts.set(key, (workflowCounts.get(key) ?? 0) + 1)
  }
  const byWorkflow: ExecutionSummaryWorkflowBreakdown[] = [...workflowCounts.entries()]
    .map(([workflow, count]) => ({ workflow, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_WORKFLOW_BREAKDOWN)

  return {
    window,
    total,
    completed,
    failureCount,
    successRate: roundSuccessRate(completed, total),
    byStatus,
    byExecutor,
    byWorkflow,
  }
}
