import { type RunEvent, truncateRunEventText } from '@planetz/shared'
import { firstNonEmptyAbortMessage } from './run-trace-text.js'
import type { RunTraceEvent } from './run-trace-types.js'

/** Convert normalized trace events to legacy `RunEvent[]` (Execution Log contract). */
export function runEventsFromTraces(traces: RunTraceEvent[]): RunEvent[] {
  const out: RunEvent[] = []
  for (const trace of traces) {
    const mapped = runEventFromTrace(trace)
    if (mapped) out.push(mapped)
  }
  return out
}

/** Map one trace to a legacy `RunEvent` (Execution Log / display adapter). */
export function runEventFromTrace(trace: RunTraceEvent): RunEvent | null {
  const base = {
    runId: trace.runId,
    runDirSlug: trace.runDirSlug,
    sessionId: trace.sessionId,
    taskId: trace.taskId,
    at: trace.at,
  }
  const stepField = trace.stepName?.trim() ? { step: trace.stepName.trim() } : {}

  switch (trace.type) {
    case 'step_start': {
      const stepName = trace.stepName ?? trace.text
      return {
        ...base,
        type: 'step_start',
        message: stepName,
        ...(stepName?.trim() ? { step: stepName.trim() } : {}),
        ...(trace.persona ? { persona: trace.persona } : {}),
      }
    }
    case 'step_complete':
      return {
        ...base,
        type: 'step_complete',
        message: trace.stepName ?? trace.text,
        ...(trace.content?.trim() ? { content: trace.content.trim() } : {}),
      }
    case 'phase_start': {
      const phaseName = trace.phaseName?.trim()
      return {
        ...base,
        type: 'log',
        message: phaseName ? `[phase:${phaseName}] started` : 'phase started',
        level: 'info',
      }
    }
    case 'phase_complete': {
      const phaseName = trace.phaseName?.trim()
      const content = trace.content?.trim()
      const prefix = phaseName ? `[phase:${phaseName}] ` : ''
      const message = content ? `${prefix}${content}` : `${prefix}phase complete`
      return {
        ...base,
        type: 'log',
        message,
        level: 'info',
      }
    }
    case 'workflow_complete':
    case 'workflow_abort':
      return {
        ...base,
        type: trace.type,
        message: firstNonEmptyAbortMessage(trace.text, trace.content) ?? trace.text,
      }
    case 'text':
    case 'thinking':
    case 'tool_use':
    case 'tool_result':
    case 'tool_output':
    case 'assistant_error':
    case 'rate_limit':
    case 'result':
    case 'log':
      return logRunEventFromTrace(trace, base, stepField)
    default:
      return null
  }
}

function logRunEventFromTrace(
  trace: RunTraceEvent,
  base: Pick<RunEvent, 'runId' | 'runDirSlug' | 'sessionId' | 'taskId' | 'at'>,
  stepField: { step?: string },
): RunEvent | null {
  const message = traceMessageForRunEvent(trace)
  if (!message?.trim()) return null
  return {
    ...base,
    type: 'log',
    message,
    level: trace.level ?? 'info',
    ...stepField,
  }
}

/** Execution Log message shape; live Detail feed uses richer copy in trace-event-to-activity. */
function traceMessageForRunEvent(trace: RunTraceEvent): string | undefined {
  switch (trace.type) {
    case 'text':
    case 'thinking':
      return trace.text
    case 'tool_use': {
      const tool = trace.toolName ?? 'tool'
      return `[tool] ${tool}`
    }
    case 'tool_result': {
      const content = trace.text ?? trace.content ?? ''
      if (!content.trim()) return undefined
      const label = trace.isError ? '✗' : '✓'
      return `${label} ${content}`
    }
    case 'tool_output':
      return trace.text ?? trace.content
    case 'assistant_error':
      return trace.text ?? trace.content
    case 'rate_limit':
      return trace.text ?? 'rate limit'
    case 'result':
      return trace.text ?? trace.content
    case 'log':
      return trace.text ?? trace.content
    default:
      return trace.text
  }
}

/** Re-export for activity projection that needs truncated preview text. */
export function previewTraceText(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined
  return truncateRunEventText(text)
}
