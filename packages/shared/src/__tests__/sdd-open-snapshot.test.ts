import { describe, expect, it } from 'vitest'
import {
  isSddOpenKiroCacheStale,
  resolveSddRecommendedEntry,
  type SddOpenSnapshot,
  SddRecommendedEntrySchema,
  sddOpenKiroFingerprintFromSpecs,
  sddOpenSnapshotKiroFingerprint,
  sddOpenSnapshotLedgerFingerprint,
  shouldShowSpecStudioComposerGuide,
} from '../sdd-open-snapshot.js'

function snapshot(partial: Partial<SddOpenSnapshot> = {}): SddOpenSnapshot {
  return {
    intentLedgerPendingCount: 0,
    intentLedgerUnanchoredCount: 0,
    kiroSpecCount: 1,
    featuresNeedingApproval: [],
    recommendedEntry: 'spec-studio',
    kiroPhase: 'requirements',
    ...partial,
  }
}

describe('shouldShowSpecStudioComposerGuide', () => {
  it('is true when spec-studio entry and kiro blocks implementation', () => {
    expect(shouldShowSpecStudioComposerGuide(snapshot())).toBe(true)
  })

  it('is false when recommended entry is dashboard', () => {
    expect(shouldShowSpecStudioComposerGuide(snapshot({ recommendedEntry: 'dashboard' }))).toBe(
      false,
    )
  })

  it('is false when kiro phase is complete', () => {
    expect(
      shouldShowSpecStudioComposerGuide(
        snapshot({
          kiroPhase: 'complete',
          featuresNeedingApproval: [{ featureId: 'f', phase: 'tasks' }],
        }),
      ),
    ).toBe(false)
  })
})

describe('SddRecommendedEntrySchema', () => {
  it('maps legacy spec-desk to spec-studio', () => {
    expect(SddRecommendedEntrySchema.parse('spec-desk')).toBe('spec-studio')
  })
})

describe('resolveSddRecommendedEntry', () => {
  it('prefers decisions when unanchored entries exist', () => {
    expect(
      resolveSddRecommendedEntry({
        pendingCount: 0,
        unanchoredCount: 1,
        featuresNeedingApproval: [],
        kiroPhase: 'requirements',
      }),
    ).toBe('decisions')
  })
})

describe('sdd open snapshot fingerprints', () => {
  it('detects kiro cache staleness when specs change', () => {
    const cached = snapshot({
      kiroPhase: 'requirements',
      featuresNeedingApproval: [{ featureId: 'billing', phase: 'requirements' }],
    })
    const staleSpecs = [
      {
        featureId: 'billing',
        specDirRel: '.kiro/specs/billing',
        parseStatus: 'ok' as const,
        approvals: {
          requirements: { approved: true },
          design: { approved: false },
          tasks: { approved: false },
        },
      },
    ]
    expect(isSddOpenKiroCacheStale(staleSpecs, cached)).toBe(true)
    expect(sddOpenKiroFingerprintFromSpecs(staleSpecs)).not.toBe(
      sddOpenSnapshotKiroFingerprint(cached),
    )
  })

  it('builds ledger fingerprint from kiro and pending counts', () => {
    const fp = sddOpenSnapshotLedgerFingerprint(
      snapshot({ intentLedgerPendingCount: 2, intentLedgerUnanchoredCount: 1 }),
    )
    expect(fp).toContain('"pending":2')
    expect(fp).toContain('requirements')
  })
})
