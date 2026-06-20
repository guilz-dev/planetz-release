import type { RunEvent, UiConfig } from '@planetz/shared'
import { collectRunEvents as collectRunEventsFromTraces } from './run-trace-parser.js'

export { collectRunTraces } from './run-trace-parser.js'
export type { RunTraceEvent, RunTraceEventType } from './run-trace-types.js'

export async function collectRunEvents(
  workspacePath: string,
  config: UiConfig,
  runDirSlugToTaskId?: ReadonlyMap<string, string>,
  additionalRunRoots?: readonly string[],
): Promise<RunEvent[]> {
  return collectRunEventsFromTraces(workspacePath, config, runDirSlugToTaskId, additionalRunRoots)
}

/**
 * Derive highlighted step from events already scoped to one task (and usually one run).
 * Caller must preserve chronological order (same contract as `collectRunEvents` output).
 */
export function resolveActiveStepFromRunEvents(
  events: RunEvent[],
  workflowStepNames: string[],
): string | undefined {
  if (workflowStepNames.length === 0) return undefined
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i]
    if (ev.type === 'step_start' && ev.message && workflowStepNames.includes(ev.message)) {
      return ev.message
    }
    if (ev.type === 'step_complete' && ev.message) {
      const idx = workflowStepNames.indexOf(ev.message)
      if (idx >= 0 && idx + 1 < workflowStepNames.length) {
        return workflowStepNames[idx + 1]
      }
    }
    const stepHint = ev.step?.trim()
    if (stepHint && workflowStepNames.includes(stepHint)) {
      return stepHint
    }
  }
  return undefined
}

/** Derive highlighted step for `taskId` from a mixed event stream (filters by task first). */
export function resolveActiveStep(
  events: RunEvent[],
  taskId: string | undefined,
  workflowStepNames: string[],
): string | undefined {
  if (!taskId) return undefined
  const forTask = events.filter((e) => e.taskId === taskId)
  return resolveActiveStepFromRunEvents(forTask, workflowStepNames)
}
