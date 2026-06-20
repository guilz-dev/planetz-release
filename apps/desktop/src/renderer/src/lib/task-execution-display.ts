import type {
  ExecutorState,
  PersonaAttributionSource,
  TaskViewModel,
  WorkflowSummary,
} from '@planetz/shared'

function stripWorkflowFileExtension(value: string): string {
  return value.toLowerCase().endsWith('.yaml') ? value.slice(0, -5) : value
}

function takeLastPathSegment(value: string): string {
  const parts = value.split('/').filter(Boolean)
  return parts.at(-1) ?? value
}

export function normalizeWorkflowIdentifier(workflow: string | undefined): string | undefined {
  const trimmed = workflow?.trim()
  if (!trimmed) return undefined
  if (!trimmed.includes('/')) return trimmed
  return stripWorkflowFileExtension(takeLastPathSegment(trimmed))
}

export function formatWorkflowDisplayName(workflow: string | undefined): string | undefined {
  const trimmed = workflow?.trim()
  if (!trimmed) return undefined
  const normalized = normalizeWorkflowIdentifier(trimmed)
  return normalized ?? stripWorkflowFileExtension(trimmed)
}

export function resolveWorkflowStepIndex(
  workflow: WorkflowSummary | undefined,
  activeStep: string | undefined,
): number {
  if (!workflow || !activeStep) return -1
  return workflow.stepNames.indexOf(activeStep)
}

export function resolveExecutorDisplay(
  task: TaskViewModel,
  executors: ExecutorState[] | undefined,
): {
  label: string | undefined
  ariaLabel: string | undefined
} {
  const attribution = task.executorAttribution
  const executorId = attribution?.executorId
  if (!executorId) return { label: undefined, ariaLabel: undefined }

  const executor = executors?.find((e) => e.id === executorId)
  const label = executor?.displayName ?? executorId
  const personaHint =
    attribution?.persona && attribution.personaSource
      ? `; persona ${attribution.persona} (${attribution.personaSource})`
      : attribution?.persona
        ? `; persona ${attribution.persona}`
        : ''
  const ariaLabel = executor
    ? `Executor: ${executor.displayName}${personaHint}${
        attribution?.source ? ` (${attribution.source}, ${attribution.confidence} confidence)` : ''
      }`
    : undefined
  return { label, ariaLabel }
}

export function describePersonaAttributionSource(
  source: PersonaAttributionSource | undefined,
): string | undefined {
  if (source === 'runtime-event') return 'Persona from run log'
  if (source === 'workflow-yaml') return 'Persona from workflow YAML'
  return undefined
}

/** Screen-reader / tooltip summary for workflow step progress. */
export function describeWorkflowProgress(steps: string[], activeIdx: number): string {
  if (steps.length === 0) return ''
  if (activeIdx < 0) return `Workflow: ${steps.join(' › ')}`
  return steps
    .map((step, i) => {
      if (i < activeIdx) return `${step} ✓`
      if (i === activeIdx) return `${step} (running)`
      return step
    })
    .join(' › ')
}
