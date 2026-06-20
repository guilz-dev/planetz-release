import { z } from 'zod'
import { diffFileStatusSchema, taskResultDiffFileSchema } from './task-result-diff.js'

export const CHAT_SESSION_MISMATCH_CODE = 'session_mismatch'
export const CHAT_SESSION_NOT_APPLICABLE_CODE = 'session_not_applicable'

export const chatApplySkipReasonSchema = z.enum([
  'workspace_modified_since_base',
  'deleted_on_workspace',
  'renamed_on_workspace',
  'deleted_not_supported',
  'rename_requires_manual_apply',
  'binary_not_supported',
  'not_applicable_status',
])

export type ChatApplySkipReason = z.infer<typeof chatApplySkipReasonSchema>

export const chatApplySessionMetaSchema = z.object({
  composerSessionId: z.string().trim().min(1),
  threadId: z.string().trim().min(1),
  baseRef: z.string().trim().min(1),
  isolatedRepoPath: z.string().trim().min(1),
  workspacePath: z.string().trim().min(1),
  capturedAt: z.string().trim().min(1),
})

export type ChatApplySessionMeta = z.infer<typeof chatApplySessionMetaSchema>

export const chatApplyEventPayloadSchema = z.object({
  kind: z.literal('applied'),
  appliedAt: z.string().trim().min(1),
  appliedPaths: z.array(z.string().min(1)),
  baseRef: z.string().trim().min(1),
  composerSessionId: z.string().trim().min(1),
})

export type ChatApplyEventPayload = z.infer<typeof chatApplyEventPayloadSchema>

export const chatSessionThreadInputSchema = z.object({
  threadId: z.string().trim().min(1),
  expectedSessionId: z.string().trim().min(1).optional(),
})

export type ChatSessionThreadInput = z.infer<typeof chatSessionThreadInputSchema>

export const chatSessionPendingFileSchema = z.object({
  path: z.string().min(1),
  oldPath: z.string().min(1).optional(),
  status: diffFileStatusSchema,
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  conflict: z.boolean(),
  applicable: z.boolean(),
  skipReason: chatApplySkipReasonSchema.optional(),
})

export type ChatSessionPendingFile = z.infer<typeof chatSessionPendingFileSchema>

export const chatSessionPendingChangesResultSchema = z.object({
  threadId: z.string().trim().min(1),
  composerSessionId: z.string().trim().min(1),
  baseRef: z.string().trim().min(1),
  files: z.array(chatSessionPendingFileSchema),
  truncated: z.boolean().optional(),
})

export type ChatSessionPendingChangesResult = z.infer<typeof chatSessionPendingChangesResultSchema>

export const chatSessionPendingChangeFileInputSchema = chatSessionThreadInputSchema.extend({
  path: z.string().trim().min(1),
})

export type ChatSessionPendingChangeFileInput = z.infer<
  typeof chatSessionPendingChangeFileInputSchema
>

export const chatSessionApplyStrategySchema = z.enum(['skip_conflicts', 'all_or_nothing'])

export const chatSessionApplyChangesInputSchema = chatSessionThreadInputSchema.extend({
  paths: z.array(z.string().trim().min(1)),
  strategy: chatSessionApplyStrategySchema.optional(),
})

export type ChatSessionApplyChangesInput = z.infer<typeof chatSessionApplyChangesInputSchema>

export const chatSessionApplySkippedSchema = z.object({
  path: z.string().min(1),
  reason: chatApplySkipReasonSchema,
})

export const chatSessionApplyChangesResultSchema = z.object({
  applied: z.array(z.string().min(1)),
  skipped: z.array(chatSessionApplySkippedSchema),
  artifactId: z.string().trim().min(1).optional(),
})

export type ChatSessionApplyChangesResult = z.infer<typeof chatSessionApplyChangesResultSchema>

export const chatSessionPendingChangeFileResultSchema = taskResultDiffFileSchema

export type ChatSessionPendingChangeFileResult = z.infer<
  typeof chatSessionPendingChangeFileResultSchema
>
