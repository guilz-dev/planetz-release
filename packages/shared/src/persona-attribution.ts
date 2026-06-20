import type { PersonaAttributionSource, RunEvent, WorkflowSummary } from './types.js'

export interface ResolvedPersonaForAttribution {
  persona: string
  source: PersonaAttributionSource
}

/** Raw workflow step persona (YAML `persona` field or legacy agentRoles index). */
export function personaForWorkflowStep(
  workflow: WorkflowSummary | undefined,
  stepName: string | undefined,
): string | undefined {
  if (!workflow || !stepName) return undefined
  const fromSteps = workflow.steps?.find((s) => s.name === stepName)?.persona
  if (fromSteps) return fromSteps
  const idx = workflow.stepNames.indexOf(stepName)
  if (idx >= 0 && workflow.agentRoles[idx]) return workflow.agentRoles[idx]
  return undefined
}

function stepNameFromRunEvent(ev: RunEvent): string | undefined {
  const fromStep = ev.step?.trim()
  if (fromStep) return fromStep
  if (ev.type === 'step_start' || ev.type === 'step_complete') {
    return ev.message?.trim() || undefined
  }
  return undefined
}

/**
 * Latest persona on a matching step_start in run-scoped events (Orbit log field when present).
 * Does not recompute Orbit personaDisplayName from facets.
 */
export function personaFromRunEventsForStep(
  events: RunEvent[] | undefined,
  stepName: string | undefined,
  activeRunId?: string,
): string | undefined {
  if (!events?.length || !stepName) return undefined
  const scoped = activeRunId !== undefined ? events.filter((e) => e.runId === activeRunId) : events
  for (let i = scoped.length - 1; i >= 0; i -= 1) {
    const ev = scoped[i]
    if (ev.type !== 'step_start') continue
    const name = stepNameFromRunEvent(ev)
    if (name !== stepName) continue
    const persona = ev.persona?.trim()
    if (persona) return persona
  }
  return undefined
}

export interface ResolvePersonaForAttributionInput {
  activeStep?: string
  workflow?: WorkflowSummary
  runEvents?: RunEvent[]
  activeRunId?: string
}

/** Runtime event persona first; workflow raw `persona` as fallback. */
export function resolvePersonaForAttribution(
  input: ResolvePersonaForAttributionInput,
): ResolvedPersonaForAttribution | undefined {
  const { activeStep, workflow, runEvents, activeRunId } = input
  if (!activeStep) return undefined

  const fromEvent = personaFromRunEventsForStep(runEvents, activeStep, activeRunId)
  if (fromEvent) {
    return { persona: fromEvent, source: 'runtime-event' }
  }

  const fromWorkflow = personaForWorkflowStep(workflow, activeStep)
  if (fromWorkflow) {
    return { persona: fromWorkflow, source: 'workflow-yaml' }
  }

  return undefined
}
