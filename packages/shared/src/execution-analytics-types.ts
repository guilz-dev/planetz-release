import type { RunEvent, TaskStatus } from './types.js'

export type ExecutionAnalyticsWindow = '24h' | '7d' | '30d' | 'all'

export type ExecutionLogEventTypeFilter = RunEvent['type'] | 'all'

export type ExecutionLogTaskStatusFilter = TaskStatus | 'all'

export type ExecutionLogSource = 'planetz'

export interface ExecutionLogRecord {
  id: string
  at: string
  taskId?: string
  taskTitle?: string
  runId: string
  executorId?: string
  executorName?: string
  source: ExecutionLogSource
  eventType: RunEvent['type']
  level?: 'info' | 'warn' | 'error'
  message?: string
  taskStatus?: TaskStatus
}

export interface ExecutionLogQuery {
  keyword?: string
  window?: ExecutionAnalyticsWindow
  eventType?: ExecutionLogEventTypeFilter
  taskStatus?: ExecutionLogTaskStatusFilter
  executorId?: string | 'all'
  runId?: string
  cursor?: string
  limit?: number
}

export interface ExecutionLogListResult {
  records: ExecutionLogRecord[]
  total: number
  truncated: boolean
  /** Event count after window filter only (before other filters). */
  rawTotalInWindow?: number
  nextCursor?: string
  hasMore?: boolean
}

export interface ExecutionSummaryStatusBreakdown {
  status: TaskStatus
  count: number
}

export interface ExecutionSummaryExecutorBreakdown {
  executorId: string
  executorName: string
  count: number
}

export interface ExecutionSummaryWorkflowBreakdown {
  workflow: string
  count: number
}

export interface ExecutionSummary {
  window: ExecutionAnalyticsWindow
  total: number
  completed: number
  failureCount: number
  successRate: number
  byStatus: ExecutionSummaryStatusBreakdown[]
  byExecutor: ExecutionSummaryExecutorBreakdown[]
  byWorkflow: ExecutionSummaryWorkflowBreakdown[]
}
