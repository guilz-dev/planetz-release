import { describe, expect, it } from 'vitest'
import { isDecisionUnanchored, isLedgerEntryUnanchored } from '../intent-ledger-trace.js'

describe('isDecisionUnanchored', () => {
  it('returns true when satisfies, deviates, and source are all absent', () => {
    expect(isDecisionUnanchored({})).toBe(true)
    expect(isDecisionUnanchored({ satisfies: [], deviates: [], source: '' })).toBe(true)
  })

  it('returns false when satisfies has entries', () => {
    expect(isDecisionUnanchored({ satisfies: ['REQ-auth-1'] })).toBe(false)
  })

  it('returns false when deviates has entries', () => {
    expect(isDecisionUnanchored({ deviates: ['DSN-ui-2'] })).toBe(false)
  })

  it('returns false when source or sourceDoc is set', () => {
    expect(isDecisionUnanchored({ source: 'design.md §API' })).toBe(false)
    expect(isDecisionUnanchored({ sourceDoc: 'requirements.md' })).toBe(false)
  })
})

describe('isLedgerEntryUnanchored', () => {
  it('uses observedUnanchored for observed authority instead of sourceDoc evidence', () => {
    expect(
      isLedgerEntryUnanchored({
        authority: 'observed',
        sourceDoc: 'src/auth.ts:42',
        observedUnanchored: true,
      }),
    ).toBe(true)
    expect(
      isLedgerEntryUnanchored({
        authority: 'observed',
        sourceDoc: 'src/auth.ts:42',
        observedUnanchored: false,
      }),
    ).toBe(false)
  })

  it('delegates to isDecisionUnanchored for non-observed authority', () => {
    expect(
      isLedgerEntryUnanchored({
        authority: 'assumed',
        sourceDoc: 'design.md',
      }),
    ).toBe(false)
  })
})
