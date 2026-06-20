import { describe, expect, it } from 'vitest'
import { coerceIsoTimestamp, parseAnalyticsInstant } from '../planetz/analytics-timestamp.js'
import { isWithinAnalyticsWindow } from '../planetz/analytics-window.js'

describe('analytics timestamp coercion', () => {
  it('parses unix seconds and milliseconds', () => {
    const seconds = 1_716_800_000
    expect(coerceIsoTimestamp(seconds, 'fallback')).toBe(new Date(seconds * 1000).toISOString())
    const millis = 1_716_800_000_123
    expect(coerceIsoTimestamp(millis, 'fallback')).toBe(new Date(millis).toISOString())
  })

  it('parses YAML Date nodes', () => {
    const date = new Date('2026-05-27T10:17:39.553Z')
    expect(coerceIsoTimestamp(date, 'fallback')).toBe(date.toISOString())
  })

  it('includes numeric completed_at timestamps in analytics windows', () => {
    const now = Date.UTC(2026, 4, 28, 12, 0, 0)
    const recentSeconds = Math.floor((now - 2 * 60 * 60 * 1000) / 1000)
    const iso = coerceIsoTimestamp(recentSeconds, '')
    expect(isWithinAnalyticsWindow(iso, '7d', now)).toBe(true)
    expect(parseAnalyticsInstant(iso)).not.toBeNull()
  })
})
