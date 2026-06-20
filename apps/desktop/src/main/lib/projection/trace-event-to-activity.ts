import {
  type StepActivityEntry,
  type StepActivityKind,
  type TaskExecutionActivityEntry,
  type TaskExecutionActivityKind,
  truncateRunEventText,
} from '@planetz/shared'
import { previewTraceText } from '../run-events-from-traces.js'
import {
  formatRunTraceLogActivityText,
  formatRunTracePhaseActivityText,
  formatRunTraceStepCompleteText,
} from '../run-trace-display.js'
import type { RunTraceEvent } from '../run-trace-types.js'

interface ActivityCore {
  at: string
  kind: TaskExecutionActivityKind
  text: string
  level?: 'info' | 'warn' | 'error'
  stepName?: string
  phaseName?: string
  toolName?: string
  runId?: string
}

export function traceToTaskExecutionEntry(ev: RunTraceEvent): TaskExecutionActivityEntry | null {
  const core = traceToActivityCore(ev)
  if (!core) return null
  return {
    at: core.at,
    kind: core.kind,
    text: core.text,
    ...(core.level ? { level: core.level } : {}),
    ...(core.stepName ? { stepName: core.stepName } : {}),
    ...(core.phaseName ? { phaseName: core.phaseName } : {}),
    ...(core.toolName ? { toolName: core.toolName } : {}),
    ...(core.runId ? { runId: core.runId } : {}),
  }
}

export function traceToStepActivityEntry(ev: RunTraceEvent): StepActivityEntry | null {
  const core = traceToActivityCore(ev)
  if (!core) return null
  return {
    at: core.at,
    kind: taskKindToStepKind(core.kind),
    text: core.text,
    ...(core.level ? { level: core.level } : {}),
  }
}

function traceToActivityCore(ev: RunTraceEvent): ActivityCore | null {
  const runId = ev.runId
  const stepName = ev.stepName?.trim()
  const phaseName = ev.phaseName?.trim()

  switch (ev.type) {
    case 'text': {
      const text = ev.text?.trim()
      if (!text) return null
      return {
        at: ev.at,
        kind: 'text',
        text: truncateRunEventText(text),
        level: ev.level ?? 'info',
        stepName,
        runId,
      }
    }
    case 'thinking': {
      const text = ev.text?.trim()
      if (!text) return null
      return {
        at: ev.at,
        kind: 'thinking',
        text: truncateRunEventText(text),
        level: 'info',
        stepName,
        runId,
      }
    }
    case 'tool_use': {
      const tool = ev.toolName ?? 'tool'
      // Detail live feed copy; Execution Log uses `[tool] name` via runEventsFromTraces.
      return {
        at: ev.at,
        kind: 'tool_use',
        text: `Running ${tool}`,
        level: 'info',
        stepName,
        toolName: tool,
        runId,
      }
    }
    case 'tool_output': {
      const raw = ev.text ?? ev.content ?? ''
      if (!raw.trim()) return null
      const preview = previewTraceText(raw) ?? raw
      return {
        at: ev.at,
        kind: 'tool_output',
        text: preview,
        level: 'info',
        stepName,
        toolName: ev.toolName,
        runId,
      }
    }
    case 'tool_result': {
      const content = ev.text ?? ev.content ?? ''
      if (!content.trim()) return null
      const prefix = ev.isError ? 'Error:' : 'OK:'
      return {
        at: ev.at,
        kind: 'tool_result',
        text: `${prefix} ${truncateRunEventText(content)}`,
        level: ev.isError ? 'error' : 'info',
        stepName,
        runId,
      }
    }
    case 'phase_start':
    case 'phase_complete': {
      const text = formatRunTracePhaseActivityText(ev)
      if (!text?.trim()) return null
      return {
        at: ev.at,
        kind: 'phase',
        text,
        level: 'info',
        phaseName,
        stepName,
        runId,
      }
    }
    case 'step_start':
      return {
        at: ev.at,
        kind: 'step',
        text: ev.stepName ? `step started: ${ev.stepName}` : 'step started',
        level: 'info',
        stepName: ev.stepName,
        runId,
      }
    case 'step_complete': {
      const text =
        formatRunTraceStepCompleteText(ev) ??
        (ev.stepName ? `step complete: ${ev.stepName}` : 'step complete')
      if (!text?.trim()) return null
      return {
        at: ev.at,
        kind: 'step',
        text,
        level: ev.level ?? 'info',
        stepName: ev.stepName,
        runId,
      }
    }
    case 'assistant_error': {
      const text = ev.text ?? ev.content ?? 'assistant error'
      return {
        at: ev.at,
        kind: 'error',
        text: truncateRunEventText(text),
        level: 'error',
        stepName,
        runId,
      }
    }
    case 'rate_limit':
      return {
        at: ev.at,
        kind: 'status',
        text: ev.text?.trim() || 'rate limit',
        level: 'warn',
        stepName,
        runId,
      }
    case 'result':
      return {
        at: ev.at,
        kind: 'status',
        text: truncateRunEventText(ev.text ?? ev.content ?? 'result'),
        level: 'info',
        stepName,
        runId,
      }
    case 'workflow_abort':
      return {
        at: ev.at,
        kind: 'error',
        text: ev.text?.trim() || 'workflow aborted',
        level: 'error',
        runId,
      }
    case 'workflow_complete':
      return {
        at: ev.at,
        kind: 'status',
        text: ev.text?.trim() || 'workflow complete',
        level: 'info',
        runId,
      }
    case 'log': {
      const text = formatRunTraceLogActivityText(ev) ?? ev.text
      if (!text?.trim()) return null
      return {
        at: ev.at,
        kind: 'status',
        text,
        level: ev.level ?? 'info',
        stepName,
        runId,
      }
    }
    default:
      return null
  }
}

function taskKindToStepKind(kind: TaskExecutionActivityKind): StepActivityKind {
  switch (kind) {
    case 'text':
      return 'message'
    case 'thinking':
      return 'thinking'
    case 'tool_use':
      return 'tool_use'
    case 'tool_output':
      return 'tool_output'
    case 'tool_result':
      return 'tool_result'
    case 'phase':
      return 'phase'
    case 'step':
      return 'step'
    case 'error':
      return 'error'
    case 'status':
      return 'status'
    default:
      return 'log'
  }
}
