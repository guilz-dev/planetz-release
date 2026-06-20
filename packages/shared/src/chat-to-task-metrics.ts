import { z } from 'zod'

/** Sidecar counters for Chat → Add Task handoff (per workspace). */
export const CHAT_TO_TASK_METRIC_EVENTS = [
  'chat_add_to_task_click',
  'chat_to_task_conflict_replace',
  'chat_to_task_conflict_append',
  'chat_to_task_conflict_cancel',
  'chat_to_task_handoff_truncated',
  'chat_to_task_retry',
  'chat_add_to_task_failed',
  'chat_to_task_apply_failed',
] as const

export const chatToTaskMetricEventSchema = z.enum(CHAT_TO_TASK_METRIC_EVENTS)

export type ChatToTaskMetricEvent = z.infer<typeof chatToTaskMetricEventSchema>

const chatToTaskMetricCountSchema = z.number().int().nonnegative()

/** Sparse per-event counters; only known events are persisted after load. */
export const chatToTaskMetricsSchema = z.object({
  counts: z.record(z.string(), chatToTaskMetricCountSchema).superRefine((counts, ctx) => {
    for (const key of Object.keys(counts)) {
      if (!chatToTaskMetricEventSchema.safeParse(key).success) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown chat to task metric event: ${key}`,
          path: [key],
        })
      }
    }
  }),
  updatedAt: z.string(),
})

export type ChatToTaskMetrics = z.infer<typeof chatToTaskMetricsSchema>

export const chatToTaskMetricRecordInputSchema = z.object({
  event: chatToTaskMetricEventSchema,
})

export type ChatToTaskMetricRecordInput = z.infer<typeof chatToTaskMetricRecordInputSchema>

export function isChatToTaskMetricEvent(value: string): value is ChatToTaskMetricEvent {
  return chatToTaskMetricEventSchema.safeParse(value).success
}
