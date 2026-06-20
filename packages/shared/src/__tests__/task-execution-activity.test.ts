import { describe, expect, it } from 'vitest'
import { deriveActivityState } from '../task-execution-activity.js'
import { ACTIVITY_ACTIVE_MS, ACTIVITY_QUIET_MS } from '../task-execution-constants.js'

describe('deriveActivityState', () => {
  const now = Date.parse('2026-06-02T12:00:00.000Z')

  it('returns unknown when lastEventAt is missing', () => {
    expect(deriveActivityState(undefined, now)).toBe('unknown')
  })

  it('returns active within active threshold', () => {
    const at = new Date(now - ACTIVITY_ACTIVE_MS + 1000).toISOString()
    expect(deriveActivityState(at, now)).toBe('active')
  })

  it('returns quiet between active and quiet thresholds', () => {
    const at = new Date(now - ACTIVITY_ACTIVE_MS - 1000).toISOString()
    expect(deriveActivityState(at, now)).toBe('quiet')
  })

  it('returns stale at or beyond quiet threshold', () => {
    const at = new Date(now - ACTIVITY_QUIET_MS).toISOString()
    expect(deriveActivityState(at, now)).toBe('stale')
  })
})
