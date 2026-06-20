import { describe, expect, it } from 'vitest'
import {
  applyKiroPhaseToRequirements,
  kiroPhaseBlocksImplementation,
  listKiroFeaturesNeedingApproval,
  resolveKiroRoutingContextFromSpecs,
  resolveKiroRoutingPhase,
} from '../kiro-phase-routing.js'
import { buildKiroSpecSummary } from '../kiro-spec-contract.js'
import { resolveSddRecommendedEntry } from '../sdd-open-snapshot.js'
import type { TaskRoutingRequirements } from '../workflow-structure-routing-schema.js'

describe('kiro phase routing', () => {
  const feature = buildKiroSpecSummary({
    featureId: 'auth',
    specDirRel: '.kiro/specs/auth',
    rawJson: JSON.stringify({
      approvals: {
        requirements: { approved: true },
        design: { approved: false },
        tasks: { approved: false },
      },
    }),
  })

  it('resolves design phase when requirements approved only', () => {
    expect(resolveKiroRoutingPhase(feature)).toBe('design')
    expect(kiroPhaseBlocksImplementation('design')).toBe(true)
    expect(kiroPhaseBlocksImplementation('complete')).toBe(false)
  })

  it('lists features needing approval', () => {
    const pending = listKiroFeaturesNeedingApproval([feature])
    expect(pending.map((row) => row.phase)).toEqual(['design', 'tasks'])
  })

  it('clears implementationAlreadyDecided when kiro blocks impl', () => {
    const ctx = resolveKiroRoutingContextFromSpecs([feature])
    expect(ctx?.kiroPhase).toBe('design')
    const baseRequirements: TaskRoutingRequirements = {
      intent: [],
      expectedOutput: [],
      mayModifyCode: true,
      implementationAlreadyDecided: true,
      needsRootCauseAnalysis: false,
      needsTestWriting: false,
      needsDeepReview: false,
      targetSurfaces: ['general'],
      ambiguity: 'medium',
      blockingUnknowns: [],
    }
    const adjusted = applyKiroPhaseToRequirements(baseRequirements, ctx)
    expect(adjusted.implementationAlreadyDecided).toBe(false)
    expect(adjusted.kiroRouting?.specFeatureId).toBe('auth')
  })
})

describe('resolveSddRecommendedEntry', () => {
  it('prefers decisions when unanchored backlog exists', () => {
    expect(
      resolveSddRecommendedEntry({
        pendingCount: 0,
        unanchoredCount: 2,
        featuresNeedingApproval: [],
        kiroPhase: 'complete',
      }),
    ).toBe('decisions')
  })

  it('prefers spec desk when kiro phase blocks implementation', () => {
    expect(
      resolveSddRecommendedEntry({
        pendingCount: 0,
        unanchoredCount: 0,
        featuresNeedingApproval: [{ featureId: 'auth', phase: 'tasks' }],
        kiroPhase: 'tasks',
      }),
    ).toBe('spec-studio')
  })
})
