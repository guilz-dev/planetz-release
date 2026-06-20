import { formatRunEventDisplayMessage, truncateRunEventText } from '@planetz/shared'
import { runEventFromTrace } from './run-events-from-traces.js'
import type { RunTraceEvent } from './run-trace-types.js'

/** Activity / status text for `step_complete` traces (matches Execution Log formatting). */
export function formatRunTraceStepCompleteText(trace: RunTraceEvent): string | undefined {
  if (trace.type !== 'step_complete') return undefined
  const msg = trace.stepName?.trim() ?? trace.text?.trim()
  const content = trace.content?.trim()
  if (content) {
    const head = msg ? `step complete: ${msg}` : 'step complete'
    return `${head}\n${truncateRunEventText(content)}`
  }
  return msg ?? trace.text?.trim() ?? undefined
}

/** Activity text for phase traces while preserving any phase-complete payload content. */
export function formatRunTracePhaseActivityText(trace: RunTraceEvent): string | undefined {
  if (trace.type !== 'phase_start' && trace.type !== 'phase_complete') return undefined
  const phaseName = trace.phaseName?.trim()
  if (trace.type === 'phase_start') {
    return phaseName ? `[phase:${phaseName}] started` : 'phase started'
  }
  const content = trace.content?.trim()
  const prefix = phaseName ? `[phase:${phaseName}] ` : ''
  return content ? `${prefix}${truncateRunEventText(content)}` : `${prefix}phase complete`
}

/** Activity text for generic `log` traces via the RunEvent display adapter. */
export function formatRunTraceLogActivityText(trace: RunTraceEvent): string | undefined {
  if (trace.type !== 'log') return undefined
  const runEv = runEventFromTrace(trace)
  if (runEv) return formatRunEventDisplayMessage(runEv)
  const text = trace.text ?? trace.content
  return text?.trim() ? truncateRunEventText(text) : undefined
}
