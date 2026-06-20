import { describe, expect, it } from 'vitest'
import type { StructureRoutingCandidate } from '../session/workflow-auto/candidate-builder.js'
import { validateWorkflowFinalSelection } from '../session/workflow-auto/decision-validator.js'
import { minimalFeatures } from './workflow-auto-test-fixtures.js'

const candidates: StructureRoutingCandidate[] = [
  {
    workflowName: 'default',
    group: 'general',
    routingGroups: ['general'],
    score: 0.5,
    matchedFeatures: [],
    rejected: false,
    rejectReasons: [],
    softPenalty: 1,
    features: minimalFeatures('default', { changeMode: 'read_only' }),
  },
  {
    workflowName: 'strict-flow',
    group: 'bugfix',
    routingGroups: ['bugfix'],
    score: 0.8,
    matchedFeatures: [],
    rejected: false,
    rejectReasons: [],
    softPenalty: 1,
    safetyTier: 'strict',
    features: minimalFeatures('strict-flow'),
  },
]

describe('validateWorkflowFinalSelection', () => {
  it('accepts a valid high-confidence selection', () => {
    const result = validateWorkflowFinalSelection({
      output: {
        selectedWorkflow: 'default',
        confidence: 'high',
        decisionReason: 'ok',
        comparedDifferences: [],
      },
      candidates,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.decision.selectedWorkflow).toBe('default')
      expect(result.decision.confidence).toBe('high')
    }
  })

  it('rejects low confidence', () => {
    const result = validateWorkflowFinalSelection({
      output: {
        selectedWorkflow: 'default',
        confidence: 'low',
        decisionReason: 'unsure',
        comparedDifferences: [],
      },
      candidates,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fallbackReasonCode).toBe('fallback:low-confidence')
    }
  })

  it('rejects strict workflow when confidence is not high', () => {
    const result = validateWorkflowFinalSelection({
      output: {
        selectedWorkflow: 'strict-flow',
        confidence: 'medium',
        decisionReason: 'maybe',
        comparedDifferences: [],
      },
      candidates,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects workflow outside candidates', () => {
    const result = validateWorkflowFinalSelection({
      output: {
        selectedWorkflow: 'unknown',
        confidence: 'high',
        decisionReason: 'nope',
        comparedDifferences: [],
      },
      candidates,
    })
    expect(result.ok).toBe(false)
  })
})
