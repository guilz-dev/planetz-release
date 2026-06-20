import { describe, expect, it } from 'vitest'
import {
  CHAT_TO_TASK_METRIC_EVENTS,
  chatToTaskMetricRecordInputSchema,
  chatToTaskMetricsSchema,
  isChatToTaskMetricEvent,
} from '../chat-to-task-metrics.js'

describe('chatToTaskMetricsSchema', () => {
  it('accepts a map of event counts with updatedAt', () => {
    const parsed = chatToTaskMetricsSchema.parse({
      counts: { chat_add_to_task_click: 2 },
      updatedAt: '2026-06-02T00:00:00.000Z',
    })
    expect(parsed.counts.chat_add_to_task_click).toBe(2)
  })

  it('rejects negative counts', () => {
    expect(() =>
      chatToTaskMetricsSchema.parse({
        counts: { chat_add_to_task_click: -1 },
        updatedAt: '2026-06-02T00:00:00.000Z',
      }),
    ).toThrow()
  })

  it('validates record input events', () => {
    for (const event of CHAT_TO_TASK_METRIC_EVENTS) {
      expect(chatToTaskMetricRecordInputSchema.parse({ event }).event).toBe(event)
      expect(isChatToTaskMetricEvent(event)).toBe(true)
    }
    expect(isChatToTaskMetricEvent('not_a_metric')).toBe(false)
  })
})
