import { ROUTING_REASON_CODES, type TaskRoutingRequirements } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import type { ScoredRoutingCandidate } from '../session/workflow-auto/candidate-score.js'
import {
  compareRoutingCandidatesByComplexity,
  estimateRoutingTaskComplexity,
  rerankLowComplexityViable,
  sortRoutingCandidatesByComplexity,
} from '../session/workflow-auto/routing-complexity.js'
import { minimalFeatures } from './workflow-auto-test-fixtures.js'

const simpleTask: TaskRoutingRequirements = {
  intent: ['implement'],
  expectedOutput: ['code'],
  mayModifyCode: true,
  implementationAlreadyDecided: true,
  needsRootCauseAnalysis: false,
  needsTestWriting: false,
  needsDeepReview: false,
  targetSurfaces: ['general'],
  ambiguity: 'low',
  blockingUnknowns: [],
}

const mediumTask: TaskRoutingRequirements = {
  intent: ['implement'],
  expectedOutput: ['code'],
  mayModifyCode: true,
  implementationAlreadyDecided: true,
  needsRootCauseAnalysis: true,
  needsTestWriting: false,
  needsDeepReview: false,
  targetSurfaces: ['general'],
  ambiguity: 'medium',
  blockingUnknowns: [],
}

const complexTask: TaskRoutingRequirements = {
  intent: ['implement', 'review'],
  expectedOutput: ['code', 'review-findings'],
  mayModifyCode: true,
  implementationAlreadyDecided: true,
  needsRootCauseAnalysis: true,
  needsTestWriting: true,
  needsDeepReview: true,
  targetSurfaces: ['general'],
  ambiguity: 'high',
  blockingUnknowns: ['scope'],
}

function scoredCandidate(
  workflowName: string,
  score: number,
  stepCount: number,
  patch: Parameters<typeof minimalFeatures>[1] = {},
): ScoredRoutingCandidate {
  return {
    workflowName,
    features: minimalFeatures(workflowName, { stepCount, ...patch }),
    rejected: false,
    rejectReasons: [],
    softPenalty: 1,
    score,
    matchedFeatures: [],
  }
}

describe('estimateRoutingTaskComplexity', () => {
  it('classifies single-intent low-ambiguity tasks as low', () => {
    expect(estimateRoutingTaskComplexity(simpleTask)).toBe('low')
  })

  it('classifies moderate-signal tasks as medium', () => {
    expect(estimateRoutingTaskComplexity(mediumTask)).toBe('medium')
  })

  it('classifies multi-signal tasks as high', () => {
    expect(estimateRoutingTaskComplexity(complexTask)).toBe('high')
  })
})

describe('compareRoutingCandidatesByComplexity', () => {
  it('prefers lighter workflow for simple tasks when scores are close', () => {
    const light = scoredCandidate('light-flow', 0.81, 3)
    const heavy = scoredCandidate('heavy-flow', 0.79, 20)
    expect(compareRoutingCandidatesByComplexity('low', light, heavy)).toBeLessThan(0)
  })

  it('keeps higher score when the gap exceeds the tie threshold on simple tasks', () => {
    const light = scoredCandidate('light-flow', 0.65, 3)
    const heavy = scoredCandidate('heavy-flow', 0.81, 20)
    expect(compareRoutingCandidatesByComplexity('low', heavy, light)).toBeLessThan(0)
  })
})

describe('rerankLowComplexityViable', () => {
  it('promotes the lightest workflow among three close-scoring peers', () => {
    const ranked = rerankLowComplexityViable([
      scoredCandidate('heavy-flow', 0.81, 20),
      scoredCandidate('mid-flow', 0.8, 5),
      scoredCandidate('light-flow', 0.79, 3),
    ])
    expect(ranked[0]?.workflowName).toBe('light-flow')
  })
})

describe('compareRoutingCandidatesByComplexity complex task', () => {
  it('keeps score order for complex tasks even when step counts differ', () => {
    const light = scoredCandidate('light-flow', 0.79, 3)
    const heavy = scoredCandidate('heavy-flow', 0.81, 20, {
      hasReviewLoop: true,
      hasWriteTestsStep: true,
      primaryOutputs: ['code', 'tests', 'review-findings'],
    })
    expect(compareRoutingCandidatesByComplexity('high', heavy, light)).toBeLessThan(0)
  })
})

describe('sortRoutingCandidatesByComplexity', () => {
  it('promotes lighter workflow and tags complexity match for simple tasks', () => {
    const ranked = sortRoutingCandidatesByComplexity(simpleTask, [
      scoredCandidate('heavy-flow', 0.81, 20),
      scoredCandidate('light-flow', 0.79, 3),
    ])

    expect(ranked[0]?.workflowName).toBe('light-flow')
    expect(ranked[0]?.matchedFeatures).toContain(
      ROUTING_REASON_CODES.match.complexityPreferLightweight,
    )
  })

  it('does not reorder medium-complexity tasks by step count', () => {
    const ranked = sortRoutingCandidatesByComplexity(mediumTask, [
      scoredCandidate('heavy-flow', 0.81, 20),
      scoredCandidate('light-flow', 0.79, 3),
    ])
    expect(ranked[0]?.workflowName).toBe('heavy-flow')
    expect(ranked[0]?.matchedFeatures).not.toContain(
      ROUTING_REASON_CODES.match.complexityPreferLightweight,
    )
  })

  it('does not reorder by step count for complex tasks when heavy scores higher', () => {
    const ranked = sortRoutingCandidatesByComplexity(complexTask, [
      scoredCandidate('light-flow', 0.7, 3),
      scoredCandidate('heavy-flow', 0.85, 20, {
        hasReviewLoop: true,
        hasWriteTestsStep: true,
        primaryOutputs: ['code', 'tests', 'review-findings'],
      }),
    ])

    expect(ranked[0]?.workflowName).toBe('heavy-flow')
    expect(ranked[0]?.matchedFeatures).not.toContain(
      ROUTING_REASON_CODES.match.complexityPreferLightweight,
    )
  })
})
