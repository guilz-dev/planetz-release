import { ACTIVITY_ACTIVE_MS, ACTIVITY_QUIET_MS } from './task-execution-constants.js'

export type TaskExecutionActivityState = 'active' | 'quiet' | 'stale' | 'unknown'

/** Derive live activity badge state from last event timestamp and current clock. */
export function deriveActivityState(
  lastEventAt: string | undefined,
  nowMs: number,
): TaskExecutionActivityState {
  if (!lastEventAt) return 'unknown'
  const atMs = Date.parse(lastEventAt)
  if (!Number.isFinite(atMs)) return 'unknown'
  const gap = Math.max(0, nowMs - atMs)
  if (gap < ACTIVITY_ACTIVE_MS) return 'active'
  if (gap < ACTIVITY_QUIET_MS) return 'quiet'
  return 'stale'
}
