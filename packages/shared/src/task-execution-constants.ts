/** Max task-level live activity entries projected onto running TaskViewModel. */
export const TASK_LIVE_ACTIVITY_CAP = 120

/** Below this gap since last event, UI shows "active". */
export const ACTIVITY_ACTIVE_MS = 15_000

/** Below this gap (and above active), UI shows "quiet"; at or above, "stale". */
export const ACTIVITY_QUIET_MS = 60_000
