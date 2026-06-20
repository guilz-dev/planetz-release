import { describe, expect, it } from 'vitest'
import {
  autoWorkflowDecisionSchema,
  workflowRoutingCatalogSchema,
} from '../workflow-auto-routing-schema.js'

describe('workflowRoutingCatalogSchema', () => {
  it('accepts a minimal catalog', () => {
    const parsed = workflowRoutingCatalogSchema.parse({
      version: 1,
      workflows: [
        {
          name: 'default',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    })
    expect(parsed.workflows[0]?.name).toBe('default')
  })
})

describe('autoWorkflowDecisionSchema', () => {
  it('accepts a decision with up to three alternatives', () => {
    const parsed = autoWorkflowDecisionSchema.parse({
      selectedWorkflow: 'default',
      group: 'general',
      confidence: 'high',
      score: 0.8,
      fallbackApplied: false,
      alternatives: [{ name: 'other', group: 'general', score: 0.2 }],
      reasonCodes: ['group:general'],
    })
    expect(parsed.selectedWorkflow).toBe('default')
  })

  it('accepts optional llm metadata', () => {
    const parsed = autoWorkflowDecisionSchema.parse({
      selectedWorkflow: 'default',
      group: 'general',
      confidence: 'high',
      score: 0.9,
      fallbackApplied: false,
      alternatives: [],
      reasonCodes: [],
      llm: { provider: 'cursor', latencyMs: 100 },
    })
    expect(parsed.llm?.provider).toBe('cursor')
  })
})
