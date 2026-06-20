import { describe, expect, it } from 'vitest'
import {
  isAuditFamilyMember,
  isConsolidationCandidateWorkflow,
  isExperimentalBuiltinWorkflow,
  isMiniFamilyDerivative,
  isReviewFamilyDerivative,
  resolveFamilyCanonicalWorkflowName,
  resolveWorkflowRetirementSignal,
} from '../workflow-family-policy.js'

describe('workflow-family-policy', () => {
  it('flags review derivatives but not review-default core', () => {
    expect(isReviewFamilyDerivative('review-frontend')).toBe(true)
    expect(isReviewFamilyDerivative('review-default')).toBe(false)
    expect(resolveFamilyCanonicalWorkflowName('review-frontend')).toBe('review-default')
  })

  it('flags audit family members as consolidation candidates', () => {
    expect(isAuditFamilyMember('audit-unit')).toBe(true)
    expect(isConsolidationCandidateWorkflow('audit-security')).toBe(true)
  })

  it('maps mini derivatives to minimal canonical', () => {
    expect(isMiniFamilyDerivative('default-mini')).toBe(true)
    expect(isMiniFamilyDerivative('minimal')).toBe(false)
    expect(resolveFamilyCanonicalWorkflowName('default-mini')).toBe('minimal')
  })

  it('marks experimental pack workflows', () => {
    expect(isExperimentalBuiltinWorkflow('draft')).toBe(true)
    expect(resolveWorkflowRetirementSignal('draft')).toBe('experimental')
    expect(resolveWorkflowRetirementSignal('terraform')).toBe('none')
  })

  it('marks other deprecated experimental pack members', () => {
    expect(resolveWorkflowRetirementSignal('default-draft')).toBe('experimental')
    expect(resolveWorkflowRetirementSignal('compound-eye')).toBe('experimental')
  })

  it('returns consolidation_candidate for review derivatives', () => {
    expect(resolveWorkflowRetirementSignal('review-fix-dual')).toBe('consolidation_candidate')
  })
})
