import type { TaskRoutingRequirements } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import type { StructureRoutingCandidate } from '../session/workflow-auto/candidate-builder.js'
import { pickPreferredFallbackCandidate } from '../session/workflow-auto/pick-preferred-fallback-candidate.js'
import { createUnavailableWorkflowFeatures } from '../session/workflow-auto/unavailable-workflow-features.js'

function candidate(
  workflowName: string,
  score: number,
  group: StructureRoutingCandidate['group'],
  patch: Partial<StructureRoutingCandidate['features']> = {},
): StructureRoutingCandidate {
  const base = createUnavailableWorkflowFeatures(workflowName)
  return {
    workflowName,
    features: { ...base, ...patch, workflowName },
    rejected: false,
    rejectReasons: [],
    softPenalty: 1,
    score,
    matchedFeatures: [],
    group,
    routingGroups: [group],
  }
}

const investigateVerificationRequirements: TaskRoutingRequirements = {
  intent: ['investigate', 'review', 'implement'],
  expectedOutput: ['report', 'code', 'review-findings'],
  mayModifyCode: true,
  implementationAlreadyDecided: true,
  needsRootCauseAnalysis: false,
  needsTestWriting: false,
  needsDeepReview: true,
  targetSurfaces: ['general'],
  ambiguity: 'medium',
  blockingUnknowns: [],
}

describe('pickPreferredFallbackCandidate', () => {
  it('keeps top score for implementation-first tasks', () => {
    const viable = [
      candidate('terraform', 0.87, 'general', { forcesImplementationOnAllPaths: true }),
      candidate('default', 0.63, 'general'),
    ]
    const picked = pickPreferredFallbackCandidate(
      {
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
      },
      viable,
    )
    expect(picked).toBe('terraform')
  })

  it('prefers read-friendly workflow over implementation-heavy top score for investigate verification', () => {
    const viable = [
      candidate('terraform', 0.87, 'ops', {
        forcesImplementationOnAllPaths: true,
        changeMode: 'edit_heavy',
        canCompleteWithoutEditing: false,
      }),
      candidate('audit-architecture', 0.66, 'research', {
        canCompleteWithoutEditing: true,
        dominantModes: ['investigate', 'review'],
        forcesImplementationOnAllPaths: false,
        changeMode: 'mixed',
      }),
    ]
    const picked = pickPreferredFallbackCandidate(investigateVerificationRequirements, viable)
    expect(picked).toBe('audit-architecture')
  })

  it('prefers read-friendly workflow when terraform is in general group', () => {
    const viable = [
      candidate('terraform', 0.87, 'general', {
        forcesImplementationOnAllPaths: false,
        changeMode: 'edit_heavy',
        canCompleteWithoutEditing: false,
        hasImplementationPath: true,
        investigateStepCount: 0,
        editStepCount: 3,
      }),
      candidate('audit-architecture', 0.66, 'general', {
        canCompleteWithoutEditing: true,
        dominantModes: ['investigate', 'review'],
        changeMode: 'mixed',
        investigateStepCount: 2,
        editStepCount: 1,
      }),
    ]
    const picked = pickPreferredFallbackCandidate(investigateVerificationRequirements, viable)
    expect(picked).toBe('audit-architecture')
  })

  it('gives partial fallback credit for canCompleteBeforeFirstEdit without full read-only completion', () => {
    const viable = [
      candidate('default-wrapper', 0.72, 'general', {
        forcesImplementationOnAllPaths: false,
        changeMode: 'mixed',
        canCompleteWithoutEditing: false,
        canCompleteBeforeFirstEdit: true,
        hasImplementationPath: true,
        editStepCount: 2,
      }),
      candidate('implement-heavy', 0.74, 'general', {
        forcesImplementationOnAllPaths: true,
        changeMode: 'edit_heavy',
        canCompleteWithoutEditing: false,
        canCompleteBeforeFirstEdit: false,
      }),
    ]
    const picked = pickPreferredFallbackCandidate(
      {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: false,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: true,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'medium',
        blockingUnknowns: [],
      },
      viable,
    )
    expect(picked).toBe('default-wrapper')
  })
})
