import { ROUTING_REASON_CODES, type TaskRoutingRequirements } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { filterRoutingCandidates } from '../session/workflow-auto/candidate-filter.js'
import {
  highComplexityFeatureTask,
  lowComplexityImplementTask,
  minimalFeatures,
} from './workflow-auto-test-fixtures.js'

const investigateReportRequirements: TaskRoutingRequirements = {
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
}

describe('filterRoutingCandidates', () => {
  it('hard-rejects forcesImplementationOnAllPaths when implementation not decided', () => {
    const features = new Map([
      [
        'implement-heavy',
        minimalFeatures('implement-heavy', { forcesImplementationOnAllPaths: true }),
      ],
    ])
    const filtered = filterRoutingCandidates(investigateReportRequirements, features)
    expect(filtered[0]?.rejected).toBe(true)
    expect(filtered[0]?.rejectReasons).toContain(
      ROUTING_REASON_CODES.reject.forcesImplementationOnAllPaths,
    )
  })

  it('hard-rejects mixed-path workflow for report tasks when not all paths avoid edit', () => {
    const features = new Map([
      [
        'mixed-paths',
        minimalFeatures('mixed-paths', {
          canCompleteBeforeFirstEdit: true,
          canCompleteWithoutEditing: false,
          forcesImplementationOnAllPaths: false,
          changeMode: 'mixed',
          primaryOutputs: ['report', 'code'],
        }),
      ],
    ])
    const filtered = filterRoutingCandidates(investigateReportRequirements, features)
    expect(filtered[0]?.rejected).toBe(true)
    expect(filtered[0]?.rejectReasons).toContain(ROUTING_REASON_CODES.reject.reportOutputMismatch)
  })

  it('does not hard-reject read-only investigate workflow for report tasks', () => {
    const features = new Map([
      [
        'investigate-only',
        minimalFeatures('investigate-only', {
          canCompleteBeforeFirstEdit: true,
          canCompleteWithoutEditing: true,
          forcesImplementationOnAllPaths: false,
          changeMode: 'read_only',
          primaryOutputs: ['report'],
          editStepCount: 0,
        }),
      ],
    ])
    const filtered = filterRoutingCandidates(investigateReportRequirements, features)
    expect(filtered[0]?.rejected).toBe(false)
  })

  it('hard-rejects high complexityBand workflows for low-complexity tasks', () => {
    const features = new Map([
      ['spec-driven', minimalFeatures('spec-driven', { primaryOutputs: ['report', 'code'] })],
    ])
    const catalogMetadata = new Map([['spec-driven', { complexityBand: 'high' as const }]])

    const filtered = filterRoutingCandidates(lowComplexityImplementTask, features, catalogMetadata)
    expect(filtered[0]?.rejected).toBe(true)
    expect(filtered[0]?.rejectReasons).toContain(
      ROUTING_REASON_CODES.reject.highComplexityBandForSimpleTask,
    )
  })

  it('allows high complexityBand workflows for high-complexity tasks', () => {
    const features = new Map([
      [
        'spec-driven',
        minimalFeatures('spec-driven', {
          primaryOutputs: ['report', 'code'],
          changeMode: 'mixed',
          forcesImplementationOnAllPaths: false,
          canCompleteWithoutEditing: true,
        }),
      ],
    ])
    const catalogMetadata = new Map([['spec-driven', { complexityBand: 'high' as const }]])

    const filtered = filterRoutingCandidates(highComplexityFeatureTask, features, catalogMetadata)
    expect(filtered[0]?.rejected).toBe(false)
  })
})
