import { z } from 'zod'

export const TASK_RESULT_DIFF_BRANCH_NOT_READY_CODE = 'BRANCH_NOT_READY'

/** Maximum number of files included in one diff summary response. */
export const TASK_RESULT_DIFF_MAX_FILES = 300
/** Maximum raw bytes read for one file diff payload. */
export const TASK_RESULT_DIFF_MAX_FILE_BYTES = 262_144
/** Maximum bytes returned for one diff file response. */
export const TASK_RESULT_DIFF_MAX_TOTAL_BYTES = 1_048_576
/** In-memory LRU size for per-file diff payloads. */
export const TASK_RESULT_DIFF_CACHE_SIZE = 32

export const diffFileStatusSchema = z.enum(['added', 'modified', 'deleted', 'renamed', 'binary'])

export type DiffFileStatus = z.infer<typeof diffFileStatusSchema>

export const diffLineKindSchema = z.enum(['context', 'add', 'del', 'hunk', 'meta'])

export type DiffLineKind = z.infer<typeof diffLineKindSchema>

export const taskResultDiffLineSchema = z.object({
  kind: diffLineKindSchema,
  oldNo: z.number().int().positive().optional(),
  newNo: z.number().int().positive().optional(),
  text: z.string(),
})

export type TaskResultDiffLine = z.infer<typeof taskResultDiffLineSchema>

export const diffFileSummarySchema = z.object({
  path: z.string().min(1),
  oldPath: z.string().min(1).optional(),
  status: diffFileStatusSchema,
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  binary: z.boolean().optional(),
})

export type DiffFileSummary = z.infer<typeof diffFileSummarySchema>

export const taskResultDiffSummarySchema = z.object({
  taskId: z.string().min(1),
  taskLabel: z.string().min(1).optional(),
  branch: z.string().min(1),
  baseRef: z.string().min(1),
  files: z.array(diffFileSummarySchema),
  truncated: z.boolean().optional(),
})

export type TaskResultDiffSummary = z.infer<typeof taskResultDiffSummarySchema>

export const taskResultDiffFileSchema = z.object({
  path: z.string().min(1),
  oldPath: z.string().min(1).optional(),
  status: diffFileStatusSchema,
  lines: z.array(taskResultDiffLineSchema),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  truncated: z.boolean().optional(),
  binary: z.boolean().optional(),
})

export type TaskResultDiffFile = z.infer<typeof taskResultDiffFileSchema>
