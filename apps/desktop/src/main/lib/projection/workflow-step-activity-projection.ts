import type { StepActivityEntry, WorkflowStepActivityView } from '@planetz/shared'
import type { RunTraceEvent } from '../run-trace-types.js'
import { traceToStepActivityEntry } from './trace-event-to-activity.js'

export const WORKFLOW_STEP_ACTIVITY_HISTORY_LIMIT = 40

interface StepActivityBucket {
  history: StepActivityEntry[]
  startedAt?: string
  completedAt?: string
}

/** Groups trace events into per–workflow-step activity for the Detail step list. */
export function projectWorkflowStepActivities(
  runTraces: RunTraceEvent[],
  workflowStepNames: string[],
  activeRunId: string | undefined,
): WorkflowStepActivityView[] {
  if (workflowStepNames.length === 0) return []

  const runScoped = activeRunId ? runTraces.filter((e) => e.runId === activeRunId) : runTraces

  const buckets = new Map<string, StepActivityBucket>()
  for (const name of workflowStepNames) {
    buckets.set(name, { history: [] })
  }

  let currentTopLevelStep = workflowStepNames[0]

  for (const ev of runScoped) {
    const stepMessage = ev.stepName?.trim() ?? ev.text?.trim()
    if (ev.type === 'step_start' && stepMessage && workflowStepNames.includes(stepMessage)) {
      currentTopLevelStep = stepMessage
    }

    const targetStep = resolveActivityTargetStep(ev, workflowStepNames, currentTopLevelStep)

    const entry = traceToStepActivityEntry(ev)
    if (!entry) continue

    const bucket = buckets.get(targetStep)
    if (bucket) pushActivityEntry(bucket.history, entry)

    const stepHint = ev.stepName?.trim()
    if (stepHint && workflowStepNames.includes(stepHint)) {
      currentTopLevelStep = stepHint
    }

    if (ev.type === 'step_start' && stepMessage && workflowStepNames.includes(stepMessage)) {
      const startedBucket = buckets.get(stepMessage)
      if (startedBucket && !startedBucket.startedAt) startedBucket.startedAt = ev.at
    }

    if (ev.type === 'step_complete' && stepMessage && workflowStepNames.includes(stepMessage)) {
      const completedBucket = buckets.get(stepMessage)
      if (completedBucket) completedBucket.completedAt = ev.at
      const idx = workflowStepNames.indexOf(stepMessage)
      if (idx >= 0 && idx + 1 < workflowStepNames.length) {
        currentTopLevelStep = workflowStepNames[idx + 1]
      }
    }
  }

  return workflowStepNames.map((stepName) => {
    const bucket = buckets.get(stepName)
    const history = bucket?.history ?? []
    const latest = history.length > 0 ? history[history.length - 1] : undefined
    const durationSec = buildCompletedDurationSec(bucket?.startedAt, bucket?.completedAt)
    return {
      stepName,
      history,
      ...(latest ? { latest } : {}),
      ...(bucket?.completedAt ? { completedAt: bucket.completedAt } : {}),
      ...(durationSec != null ? { durationSec } : {}),
    }
  })
}

function resolveActivityTargetStep(
  ev: RunTraceEvent,
  workflowStepNames: string[],
  currentTopLevelStep: string,
): string {
  const msg = ev.stepName?.trim() ?? ev.text?.trim()
  if (msg && workflowStepNames.includes(msg)) return msg
  return currentTopLevelStep
}

function buildCompletedDurationSec(
  startedAt: string | undefined,
  completedAt: string | undefined,
): number | undefined {
  if (!completedAt || !startedAt) return undefined

  const startMs = Date.parse(startedAt)
  const endMs = Date.parse(completedAt)
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return undefined

  return Math.floor((endMs - startMs) / 1000)
}

function pushActivityEntry(history: StepActivityEntry[], entry: StepActivityEntry): void {
  history.push(entry)
  if (history.length <= WORKFLOW_STEP_ACTIVITY_HISTORY_LIMIT) return
  history.splice(0, history.length - WORKFLOW_STEP_ACTIVITY_HISTORY_LIMIT)
}
