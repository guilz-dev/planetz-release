/** Main-internal normalized run log event (richer than `RunEvent`). */
export type RunTraceEventType =
  | 'step_start'
  | 'step_complete'
  | 'phase_start'
  | 'phase_complete'
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_output'
  | 'tool_result'
  | 'assistant_error'
  | 'rate_limit'
  | 'result'
  | 'workflow_complete'
  | 'workflow_abort'
  | 'log'

export interface RunTraceEvent {
  at: string
  runId: string
  runDirSlug: string
  sessionId: string
  taskId?: string
  type: RunTraceEventType
  stepName?: string
  phaseName?: string
  toolName?: string
  text?: string
  content?: string
  level?: 'info' | 'warn' | 'error'
  persona?: string
  /** Provider tool_result error flag. */
  isError?: boolean
}
