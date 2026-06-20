import type { TaskRoutingRequirements } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { scoreRoutingCandidates } from '../session/workflow-auto/candidate-score.js'
import { minimalFeatures } from './workflow-auto-test-fixtures.js'

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

describe('scoreRoutingCandidates', () => {
  it('gives partial investigate structureFit credit for canCompleteBeforeFirstEdit only', () => {
    const readOnly = scoreRoutingCandidates(investigateReportRequirements, [
      {
        workflowName: 'read-only',
        features: minimalFeatures('read-only', {
          canCompleteWithoutEditing: true,
          canCompleteBeforeFirstEdit: true,
          forcesImplementationOnAllPaths: false,
          changeMode: 'read_only',
          primaryOutputs: ['report'],
          editStepCount: 0,
        }),
        rejected: false,
        rejectReasons: [],
        softPenalty: 1,
      },
    ])[0]

    const beforeEditOnly = scoreRoutingCandidates(investigateReportRequirements, [
      {
        workflowName: 'wrapper',
        features: minimalFeatures('wrapper', {
          canCompleteWithoutEditing: false,
          canCompleteBeforeFirstEdit: true,
          forcesImplementationOnAllPaths: false,
          changeMode: 'mixed',
          primaryOutputs: ['report', 'code'],
          editStepCount: 1,
        }),
        rejected: false,
        rejectReasons: [],
        softPenalty: 1,
      },
    ])[0]

    expect(readOnly?.score).toBeGreaterThan(beforeEditOnly?.score ?? 0)
    expect(readOnly?.matchedFeatures).toContain('match:report-only-completion')
    expect(beforeEditOnly?.matchedFeatures).toContain('match:report-before-edit-completion')
  })
})
