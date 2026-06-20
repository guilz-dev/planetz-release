/**
 * Normalizes task / run timestamps for analytics window checks.
 * tasks.yaml may store ISO strings, unix seconds, millis, or YAML Date nodes.
 */
export function coerceIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      const parsed = Date.parse(trimmed)
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  return fallback
}

export function parseAnalyticsInstant(isoAt: string): number | null {
  const normalized = coerceIsoTimestamp(isoAt, '')
  if (!normalized) return null
  const at = Date.parse(normalized)
  return Number.isNaN(at) ? null : at
}
