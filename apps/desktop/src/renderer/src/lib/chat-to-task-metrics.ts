import type { ChatToTaskMetricEvent } from '@planetz/shared'

/** Fire-and-forget handoff metric; no-op when preload bridge is stale. */
export function recordChatToTaskMetric(event: ChatToTaskMetricEvent): void {
  const record = window.orbit?.recordChatToTaskMetric
  if (typeof record !== 'function') return
  void record({ event }).catch(() => undefined)
}
