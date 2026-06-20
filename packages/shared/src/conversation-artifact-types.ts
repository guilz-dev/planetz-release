import { z } from 'zod'

export const conversationArtifactKindSchema = z.enum([
  'task',
  'issue',
  'pr',
  'file',
  'diff',
  'log',
  'command-output',
  'summary',
])

export type ConversationArtifactKind = z.infer<typeof conversationArtifactKindSchema>

export const conversationArtifactPrioritySchema = z.enum(['high', 'normal', 'low'])

export type ConversationArtifactPriority = z.infer<typeof conversationArtifactPrioritySchema>

export const artifactRefSchema = z.object({
  kind: conversationArtifactKindSchema,
  ref: z.string().trim().min(1),
  priority: conversationArtifactPrioritySchema.optional(),
  contentHash: z.string().trim().min(1).optional(),
})

export type ArtifactRef = z.infer<typeof artifactRefSchema>

export const conversationCompactionSummarySchema = z.object({
  estimatedTokensBefore: z.number().int().nonnegative(),
  estimatedTokensAfter: z.number().int().nonnegative(),
  keptHighPriorityCount: z.number().int().nonnegative(),
  dedupedCount: z.number().int().nonnegative(),
  summarizedTurnCount: z.number().int().nonnegative(),
  droppedLowPriorityCount: z.number().int().nonnegative(),
  message: z.string(),
})

export type ConversationCompactionSummary = z.infer<typeof conversationCompactionSummarySchema>
