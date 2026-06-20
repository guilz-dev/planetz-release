import type { TaskExecutionActivityEntry, TaskExecutionStatus } from '@planetz/shared'
import type { RunTraceEvent } from '../run-trace-types.js'

export interface TaskExecutionStatusContext {
  activeRunId: string | undefined
  activeStep: string | undefined
}

export function projectTaskExecutionStatus(
  traces: RunTraceEvent[],
  ctx: TaskExecutionStatusContext,
  liveActivity: TaskExecutionActivityEntry[],
): TaskExecutionStatus | undefined {
  const last = liveActivity.length > 0 ? liveActivity[liveActivity.length - 1] : undefined

  let innerStep: string | undefined
  let phase: string | undefined
  for (let i = traces.length - 1; i >= 0; i -= 1) {
    const ev = traces[i]
    if (!innerStep && ev.stepName?.trim()) innerStep = ev.stepName.trim()
    if (!phase && ev.phaseName?.trim()) phase = ev.phaseName.trim()
    if (innerStep && phase) break
  }

  if (!ctx.activeRunId && !ctx.activeStep && !last && !innerStep && !phase) {
    return undefined
  }

  return {
    ...(ctx.activeRunId ? { runId: ctx.activeRunId } : {}),
    ...(ctx.activeStep ? { workflowStep: ctx.activeStep } : {}),
    ...(innerStep ? { innerStep } : {}),
    ...(phase ? { phase } : {}),
    ...(last ? { lastEventAt: last.at, lastEventSummary: last.text } : {}),
  }
}
