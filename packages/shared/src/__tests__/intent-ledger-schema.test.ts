import { describe, expect, it } from 'vitest'
import {
  DecisionReportSchema,
  filterValidObservationItems,
  ObservationReportSchema,
  observationDecisionId,
} from '../intent-ledger-schema.js'

describe('DecisionReportSchema', () => {
  it('parses legacy decisions.json without trace fields', () => {
    const result = DecisionReportSchema.safeParse({
      version: 1,
      decisions: [
        {
          decisionId: 'legacy-1',
          statement: 'Use SQLite',
          authority: 'assumed',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('parses decisions with satisfies and deviates', () => {
    const result = DecisionReportSchema.safeParse({
      version: 1,
      decisions: [
        {
          decisionId: 'traced-1',
          statement: 'JWT auth',
          authority: 'designed',
          satisfies: ['REQ-auth-1'],
          deviates: ['DSN-api-2'],
          source: 'design.md',
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.decisions[0]?.satisfies).toEqual(['REQ-auth-1'])
      expect(result.data.decisions[0]?.deviates).toEqual(['DSN-api-2'])
    }
  })
})

describe('ObservationReportSchema', () => {
  it('parses observation.json contract', () => {
    const result = ObservationReportSchema.safeParse({
      version: 1,
      STATUS: 'GO',
      observations: [
        {
          statement: 'Matches design',
          evidence: 'src/foo.ts:10',
          unanchored: false,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects observations with empty evidence', () => {
    const result = ObservationReportSchema.safeParse({
      version: 1,
      STATUS: 'NO-GO',
      observations: [
        {
          statement: 'Missing evidence',
          evidence: '',
          unanchored: true,
        },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('observationDecisionId', () => {
  it('prefers explicit observationId when provided', () => {
    const id = observationDecisionId(
      {
        observationId: 'drift-auth',
        statement: 'Drift',
        evidence: 'src/a.ts:1',
        unanchored: true,
      },
      () => 'unused',
    )
    expect(id).toBe('drift-auth')
  })

  it('derives stable hash id from statement and evidence', () => {
    const item = {
      statement: 'Stable row',
      evidence: 'src/foo.ts:1',
      unanchored: false,
    }
    const hashFn = (input: string) => `hash-${input.length}`
    expect(observationDecisionId(item, hashFn)).toBe('obs-hash-23')
    expect(observationDecisionId(item, hashFn)).toBe('obs-hash-23')
  })
})

describe('filterValidObservationItems', () => {
  it('drops blank evidence rows', () => {
    const kept = filterValidObservationItems([
      { statement: 'a', evidence: 'ok', unanchored: false },
      { statement: 'b', evidence: '  ', unanchored: true },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.statement).toBe('a')
  })
})
