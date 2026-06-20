import { describe, expect, it } from 'vitest'
import {
  computeValidationCoverage,
  isNakedDecidedIntent,
  orphanRequirementIds,
  parseRequirementIdsFromMarkdown,
} from '../validation-coverage.js'

describe('parseRequirementIdsFromMarkdown', () => {
  it('extracts REQ ids from level-3 headings', () => {
    const markdown = [
      '## Functional requirements',
      '',
      '### REQ-auth-1',
      '',
      'WHEN user logs in THEN issue token',
      '',
      '### REQ-auth-2',
      '',
      'More text',
    ].join('\n')
    expect(parseRequirementIdsFromMarkdown(markdown)).toEqual(['REQ-auth-1', 'REQ-auth-2'])
  })

  it('extracts REQ ids from contract-style list items', () => {
    const markdown = [
      '# Requirements',
      '',
      '## Functional requirements (with acceptance criteria)',
      '',
      '- `REQ-auth-1` WHEN a user logs in THEN issue a token.',
      '- `REQ-auth-2` WHEN a user logs out THEN revoke the token.',
      '1. `REQ-auth-3` WHEN a session expires THEN prompt for login.',
    ].join('\n')
    expect(parseRequirementIdsFromMarkdown(markdown)).toEqual([
      'REQ-auth-1',
      'REQ-auth-2',
      'REQ-auth-3',
    ])
  })

  it('returns empty for markdown without REQ declarations', () => {
    expect(parseRequirementIdsFromMarkdown('# Requirements\n\nNo ids')).toEqual([])
  })
})

describe('orphanRequirementIds', () => {
  it('returns reqs without links', () => {
    expect(orphanRequirementIds(['REQ-a-1', 'REQ-a-2'], new Set(['REQ-a-1']))).toEqual(['REQ-a-2'])
  })
})

describe('isNakedDecidedIntent', () => {
  it('is true when intent exists but no links', () => {
    expect(isNakedDecidedIntent(true, 0)).toBe(true)
    expect(isNakedDecidedIntent(true, 2)).toBe(false)
    expect(isNakedDecidedIntent(false, 0)).toBe(false)
  })
})

describe('computeValidationCoverage', () => {
  it('sums orphan counts across threads', () => {
    const summary = computeValidationCoverage({
      threads: [
        {
          threadId: 't1',
          requirementIds: ['REQ-a-1', 'REQ-a-2'],
          linkedReqIds: ['REQ-a-1'],
          hasDecidedIntent: true,
        },
        {
          threadId: 't2',
          requirementIds: ['REQ-b-1'],
          linkedReqIds: [],
          hasDecidedIntent: true,
        },
      ],
    })
    expect(summary.orphanReqCount).toBe(2)
    expect(summary.nakedIntentThreadCount).toBe(1)
    expect(summary.threads[0]?.orphanReqIds).toEqual(['REQ-a-2'])
    expect(summary.threads[1]?.isNaked).toBe(true)
  })

  it('handles empty workspace', () => {
    const summary = computeValidationCoverage({ threads: [] })
    expect(summary.orphanReqCount).toBe(0)
    expect(summary.nakedIntentThreadCount).toBe(0)
  })
})
