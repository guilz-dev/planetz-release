import { z } from 'zod'

export const modelHistoryItemSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  lastUsedAt: z.string().min(1),
  useCount: z.number().int().positive(),
})

export const modelHistorySchema = z.object({
  items: z.array(modelHistoryItemSchema),
})
