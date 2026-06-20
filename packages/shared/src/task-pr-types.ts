import { z } from 'zod'

export const TASK_PR_ERROR_CODES = [
  'gh_not_found',
  'gh_auth_required',
  'permission_denied',
  'repo_not_supported',
  'branch_not_found',
  'push_required',
  'push_failed',
  'pr_create_failed',
  'unexpected_failure',
] as const

export type TaskPrErrorCode = (typeof TASK_PR_ERROR_CODES)[number]

export const taskPrErrorCodeSchema = z.enum(TASK_PR_ERROR_CODES)

export const taskPrSummarySchema = z.object({
  number: z.number().int().positive(),
  url: z.string().url(),
  state: z.enum(['open', 'closed', 'merged']),
  isDraft: z.boolean(),
  headBranch: z.string().min(1),
  baseBranch: z.string().min(1),
})

export type TaskPrSummary = z.infer<typeof taskPrSummarySchema>

export const createResultPrResultSchema = z.object({
  status: z.enum(['created', 'already_exists']),
  pr: taskPrSummarySchema,
})

export type CreateResultPrResult = z.infer<typeof createResultPrResultSchema>

const TASK_PR_ERROR_PREFIX = '[task-pr:'

export function formatTaskPrErrorMessage(code: TaskPrErrorCode, detail?: string): string {
  const suffix = detail?.trim()
  return suffix ? `${TASK_PR_ERROR_PREFIX}${code}] ${suffix}` : `${TASK_PR_ERROR_PREFIX}${code}]`
}

export function extractTaskPrErrorCode(error: unknown): TaskPrErrorCode | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const match = message.match(/\[task-pr:([a-z_]+)\]/)
  if (!match?.[1]) return null
  const parsed = taskPrErrorCodeSchema.safeParse(match[1])
  return parsed.success ? parsed.data : null
}
