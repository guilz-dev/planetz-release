import { describe, expect, it } from 'vitest'
import {
  taskSwapWorkflowInputSchema,
  workflowAutoRoutePreviewResultSchema,
  workflowGetPreviewInputSchema,
  workflowPreviewAutoRouteInputSchema,
  workflowRunOverrideSchema,
} from '../workflow-selection-schema.js'

describe('workflow-selection-schema', () => {
  it('parses workflow preview input', () => {
    const parsed = workflowGetPreviewInputSchema.parse({ workflow: 'minimal' })
    expect(parsed.workflow).toBe('minimal')
  })

  it('parses auto route preview input with default phase', () => {
    const parsed = workflowPreviewAutoRouteInputSchema.parse({ body: 'fix bug' })
    expect(parsed.phase).toBe('deterministic')
  })

  it('parses run override payload', () => {
    const parsed = workflowRunOverrideSchema.parse({
      baseWorkflow: 'minimal',
      stepOverrides: [{ stepName: 'review', provider: 'codex', model: 'gpt-5.3-codex-high' }],
    })
    expect(parsed.stepOverrides).toHaveLength(1)
  })

  it('allows provider-only override payload', () => {
    const parsed = workflowRunOverrideSchema.parse({
      baseWorkflow: 'minimal',
      stepOverrides: [{ stepName: 'implement', provider: 'cursor' }],
    })
    expect(parsed.stepOverrides[0]?.provider).toBe('cursor')
  })

  it('rejects model-only override payload', () => {
    const result = workflowRunOverrideSchema.safeParse({
      baseWorkflow: 'minimal',
      stepOverrides: [{ stepName: 'implement', model: 'gpt-5.3-codex-high' }],
    })
    expect(result.success).toBe(false)
  })

  it('parses swap workflow input', () => {
    const parsed = taskSwapWorkflowInputSchema.parse({
      taskId: 'task-1',
      workflow: 'minimal',
    })
    expect(parsed.taskId).toBe('task-1')
  })

  it('parses auto route preview result with optional libraryAutoSuggestion', () => {
    const parsed = workflowAutoRoutePreviewResultSchema.parse({
      previewToken: 'token-1',
      promptHash: 'hash-1',
      phase: 'deterministic',
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium',
        score: 0.1,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      libraryAutoSuggestion: {
        workflowName: 'terraform',
        score: 0.42,
        displayName: 'Terraform',
        packId: 'ops',
      },
    })
    expect(parsed.libraryAutoSuggestion?.workflowName).toBe('terraform')
  })
})
