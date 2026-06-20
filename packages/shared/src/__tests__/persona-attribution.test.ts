import { describe, expect, it } from 'vitest'
import {
  personaForWorkflowStep,
  personaFromRunEventsForStep,
  resolvePersonaForAttribution,
} from '../persona-attribution.js'
import type { RunEvent, WorkflowSummary } from '../types.js'

const WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'builtin',
  stepNames: ['plan', 'implement'],
  agentRoles: ['planner', 'coder'],
  steps: [
    { name: 'plan', persona: 'planner' },
    { name: 'implement', persona: 'coder' },
  ],
  isOverridden: false,
  diagnostics: [],
}

describe('personaForWorkflowStep', () => {
  it('reads persona from steps array', () => {
    expect(personaForWorkflowStep(WORKFLOW, 'implement')).toBe('coder')
  })

  it('falls back to agentRoles by step index', () => {
    const legacy: WorkflowSummary = {
      ...WORKFLOW,
      steps: [{ name: 'plan' }, { name: 'implement' }],
    }
    expect(personaForWorkflowStep(legacy, 'implement')).toBe('coder')
  })
})

describe('personaFromRunEventsForStep', () => {
  it('returns persona from latest matching step_start in run scope', () => {
    const events: RunEvent[] = [
      {
        runId: 'r1',
        runDirSlug: 'd',
        sessionId: 's',
        taskId: 't1',
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        step: 'implement',
        message: 'implement',
        persona: 'coder-runtime',
      },
      {
        runId: 'r1',
        runDirSlug: 'd',
        sessionId: 's',
        taskId: 't1',
        type: 'step_start',
        at: '2026-05-27T10:05:00.000Z',
        step: 'implement',
        message: 'implement',
        persona: 'coder-latest',
      },
    ]
    expect(personaFromRunEventsForStep(events, 'implement', 'r1')).toBe('coder-latest')
  })
})

describe('resolvePersonaForAttribution', () => {
  it('prefers runtime event persona over workflow yaml', () => {
    const events: RunEvent[] = [
      {
        runId: 'r1',
        runDirSlug: 'd',
        sessionId: 's',
        taskId: 't1',
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        step: 'implement',
        persona: 'specialist',
      },
    ]
    const resolved = resolvePersonaForAttribution({
      activeStep: 'implement',
      workflow: WORKFLOW,
      runEvents: events,
      activeRunId: 'r1',
    })
    expect(resolved).toEqual({ persona: 'specialist', source: 'runtime-event' })
  })

  it('falls back to workflow yaml when event has no persona', () => {
    const events: RunEvent[] = [
      {
        runId: 'r1',
        runDirSlug: 'd',
        sessionId: 's',
        type: 'step_start',
        at: '2026-05-27T10:00:00.000Z',
        message: 'implement',
      },
    ]
    const resolved = resolvePersonaForAttribution({
      activeStep: 'implement',
      workflow: WORKFLOW,
      runEvents: events,
    })
    expect(resolved).toEqual({ persona: 'coder', source: 'workflow-yaml' })
  })
})
