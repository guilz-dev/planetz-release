import { z } from 'zod'

export const effortHistoryItemSchema = z.object({
  provider: z.string().min(1),
  effort: z.string().min(1),
  lastUsedAt: z.string().min(1),
  useCount: z.number().int().positive(),
})

export const effortHistorySchema = z.object({
  items: z.array(effortHistoryItemSchema),
})
