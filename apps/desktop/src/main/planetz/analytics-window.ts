import type { ExecutionAnalyticsWindow } from '@planetz/shared'
import { parseAnalyticsInstant } from './analytics-timestamp.js'

const MS_PER_HOUR = 60 * 60 * 1000

const WINDOW_MS: Record<Exclude<ExecutionAnalyticsWindow, 'all'>, number> = {
  '24h': 24 * MS_PER_HOUR,
  '7d': 7 * 24 * MS_PER_HOUR,
  '30d': 30 * 24 * MS_PER_HOUR,
}

export function isWithinAnalyticsWindow(
  isoAt: string,
  window: ExecutionAnalyticsWindow,
  nowMs = Date.now(),
): boolean {
  if (window === 'all') return true
  const at = parseAnalyticsInstant(isoAt)
  if (at === null) return false
  return at >= nowMs - WINDOW_MS[window]
}

/** ISO lower bound for SQL `created_at` / `ratified_at` filters; `null` when window is `all`. */
export function resolveAnalyticsSinceIso(
  window: ExecutionAnalyticsWindow,
  nowMs = Date.now(),
): string | null {
  if (window === 'all') return null
  return new Date(nowMs - WINDOW_MS[window]).toISOString()
}
