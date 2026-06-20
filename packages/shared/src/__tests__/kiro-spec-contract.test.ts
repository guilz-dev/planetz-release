import { describe, expect, it } from 'vitest'
import { buildKiroSpecSummary, parseKiroSpecJson } from '../kiro-spec-contract.js'
import {
  allocateNextRequirementId,
  deriveRequirementsFeatureSlug,
  formatAdoptedRequirementBlock,
} from '../requirements-promotion.js'

describe('kiro-spec-contract', () => {
  it('parses tolerant spec.json with unknown fields ignored', () => {
    const parsed = parseKiroSpecJson(
      JSON.stringify({
        version: 1,
        language: 'en',
        approvals: { requirements: { approved: true, approvedAt: '2026-06-13T00:00:00Z' } },
        extraField: 'ignored',
      }),
    )
    expect(parsed?.approvals?.requirements?.approved).toBe(true)
  })

  it('returns invalid summary for malformed JSON', () => {
    const summary = buildKiroSpecSummary({
      featureId: 'auth',
      specDirRel: '.kiro/specs/auth',
      rawJson: '{not json',
    })
    expect(summary.parseStatus).toBe('invalid')
  })

  it('returns missing summary when spec.json absent', () => {
    const summary = buildKiroSpecSummary({
      featureId: 'auth',
      specDirRel: '.kiro/specs/auth',
      rawJson: null,
    })
    expect(summary.parseStatus).toBe('missing')
  })
})

describe('requirements-promotion helpers', () => {
  it('derives feature slug from related REQ ids', () => {
    expect(
      deriveRequirementsFeatureSlug({
        relatedReqIds: ['REQ-auth-3'],
        scopeHint: 'ignored',
      }),
    ).toBe('auth')
  })

  it('allocates next REQ id append-only', () => {
    const markdown = '### REQ-auth-1\n\nExisting'
    expect(allocateNextRequirementId(markdown, 'auth')).toBe('REQ-auth-2')
    expect(allocateNextRequirementId(`${markdown}\n### REQ-auth-2`, 'auth')).toBe('REQ-auth-3')
  })

  it('formats adopted requirement block with provenance', () => {
    const block = formatAdoptedRequirementBlock({
      reqId: 'REQ-auth-2',
      statement: 'Session switch discards drafts',
      sourceRun: 'run-abc',
      decisionId: 'obs-123',
    })
    expect(block).toContain('REQ-auth-2')
    expect(block).toContain('Session switch discards drafts')
    expect(block).toContain('run-abc')
  })
})
