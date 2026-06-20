import { describe, expect, it } from 'vitest'
import {
  EXECUTOR_ID_CURSOR,
  providerToExecutorId,
  resolveTaskExecutionAttribution,
} from '../executor-attribution.js'
import type { WorkflowSummary } from '../types.js'

const ENGINE = { provider: 'cursor', model: 'auto' }
const OVERRIDES = {}

const DEFAULT_WORKFLOW: WorkflowSummary = {
  name: 'default',
  source: 'builtin',
  stepNames: ['plan', 'implement', 'review'],
  agentRoles: ['planner', 'coder', 'reviewer'],
  steps: [
    { name: 'plan', persona: 'planner' },
    { name: 'implement', persona: 'coder' },
    { name: 'review', persona: 'reviewer' },
  ],
  isOverridden: false,
  diagnostics: [],
}

describe('providerToExecutorId', () => {
  it('maps known providers to agent-external ids', () => {
    expect(providerToExecutorId('cursor')).toBe(EXECUTOR_ID_CURSOR)
    expect(providerToExecutorId('Cursor')).toBe(EXECUTOR_ID_CURSOR)
  })

  it('returns undefined for unknown provider', () => {
    expect(providerToExecutorId('unknown-vendor')).toBeUndefined()
  })
})

describe('resolveTaskExecutionAttribution', () => {
  it('prefers explicit task assignment', () => {
    const result = resolveTaskExecutionAttribution({
      taskId: 't1',
      status: 'running',
      activeStep: 'implement',
      workflow: DEFAULT_WORKFLOW,
      taskAssignmentExecutorId: 'agent-external-codex',
      engine: ENGINE,
      agentOverrides: OVERRIDES,
    })
    expect(result.source).toBe('explicit-assignment')
    expect(result.executorId).toBe('agent-external-codex')
    expect(result.confidence).toBe('high')
  })

  it('prefers runtime event persona over workflow yaml for attribution', () => {
    const engine = {
      persona_providers: { specialist: { provider: 'cursor', model: 'auto' } },
    }
    const result = resolveTaskExecutionAttribution({
      taskId: 't1',
      status: 'running',
      activeStep: 'implement',
      activeRunId: 'run-1',
      workflow: DEFAULT_WORKFLOW,
      engine,
      agentOverrides: OVERRIDES,
      runEvents: [
        {
          runId: 'run-1',
          runDirSlug: 'd',
          sessionId: 's',
          taskId: 't1',
          type: 'step_start',
          at: '2026-05-27T10:00:00.000Z',
          step: 'implement',
          persona: 'specialist',
        },
      ],
    })
    expect(result.source).toBe('workflow-step')
    expect(result.persona).toBe('specialist')
    expect(result.personaSource).toBe('runtime-event')
    expect(result.executorId).toBe(EXECUTOR_ID_CURSOR)
  })

  it('resolves workflow-step via persona and engine', () => {
    const engine = {
      provider: 'openai',
      model: 'gpt',
      persona_providers: { coder: { provider: 'cursor', model: 'auto' } },
    }
    const result = resolveTaskExecutionAttribution({
      taskId: 't1',
      status: 'running',
      activeStep: 'implement',
      workflow: DEFAULT_WORKFLOW,
      engine,
      agentOverrides: OVERRIDES,
    })
    expect(result.source).toBe('workflow-step')
    expect(result.executorId).toBe(EXECUTOR_ID_CURSOR)
    expect(result.persona).toBe('coder')
    expect(result.personaSource).toBe('workflow-yaml')
  })

  it('falls back to profile-provider when step path fails', () => {
    const result = resolveTaskExecutionAttribution({
      taskId: 't1',
      status: 'running',
      workflow: DEFAULT_WORKFLOW,
      executionProfile: { provider: 'cursor', model: 'auto' },
      engine: ENGINE,
      agentOverrides: OVERRIDES,
    })
    expect(result.source).toBe('profile-provider')
    expect(result.executorId).toBe(EXECUTOR_ID_CURSOR)
  })

  it('returns unknown for non-running tasks', () => {
    const result = resolveTaskExecutionAttribution({
      taskId: 't1',
      status: 'pending',
      engine: ENGINE,
      agentOverrides: OVERRIDES,
    })
    expect(result.source).toBe('unknown')
    expect(result.confidence).toBe('none')
    expect(result.executorId).toBeUndefined()
  })
})
