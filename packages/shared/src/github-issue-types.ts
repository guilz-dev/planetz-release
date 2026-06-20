import { z } from 'zod'

/** Maximum issue body characters included in auto-generated task draft. */
export const GITHUB_ISSUE_TASK_DRAFT_BODY_MAX = 12_000
export const GITHUB_ISSUE_LIST_OPEN_PAGE_SIZE = 20

export const GITHUB_ISSUE_ERROR_CODES = [
  'gh_not_found',
  'gh_auth_required',
  'invalid_issue_ref',
  'repo_required',
  'issue_not_found',
  'permission_denied',
  'unexpected_failure',
] as const

export type GitHubIssueErrorCode = (typeof GITHUB_ISSUE_ERROR_CODES)[number]

export const githubIssueErrorCodeSchema = z.enum(GITHUB_ISSUE_ERROR_CODES)

export const githubIssueRepositorySchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
})

export type GitHubIssueRepository = z.infer<typeof githubIssueRepositorySchema>

export const githubIssueViewSchema = z.object({
  repository: githubIssueRepositorySchema,
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  url: z.string().url(),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.string()),
  author: z.string().optional(),
})

export type GitHubIssueView = z.infer<typeof githubIssueViewSchema>

export const githubIssueFetchInputSchema = z.object({
  ref: z.string().trim().min(1),
})

export type GitHubIssueFetchInput = z.infer<typeof githubIssueFetchInputSchema>

export const githubIssueListItemSchema = z.object({
  repository: githubIssueRepositorySchema,
  number: z.number().int().positive(),
  title: z.string(),
  url: z.string().url(),
  createdAt: z.string().min(1),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.string()),
  author: z.string().optional(),
})

export type GitHubIssueListItem = z.infer<typeof githubIssueListItemSchema>

export const githubIssueListOpenInputSchema = z
  .object({
    after: z.string().trim().min(1).optional(),
  })
  .optional()
  .transform((input) => input ?? {})

export type GitHubIssueListOpenInput = z.infer<typeof githubIssueListOpenInputSchema>

export const githubIssueListPageInfoSchema = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
})

export const githubIssueListOpenResultSchema = z.object({
  repository: githubIssueRepositorySchema,
  items: z.array(githubIssueListItemSchema),
  pageInfo: githubIssueListPageInfoSchema,
})

export type GitHubIssueListOpenResult = z.infer<typeof githubIssueListOpenResultSchema>

const GITHUB_ISSUE_ERROR_PREFIX = '[github-issue:'

export function formatGitHubIssueErrorMessage(code: GitHubIssueErrorCode, detail?: string): string {
  const suffix = detail?.trim()
  return suffix
    ? `${GITHUB_ISSUE_ERROR_PREFIX}${code}] ${suffix}`
    : `${GITHUB_ISSUE_ERROR_PREFIX}${code}]`
}

export function extractGitHubIssueErrorCode(error: unknown): GitHubIssueErrorCode | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const match = message.match(/\[github-issue:([a-z_]+)\]/)
  if (!match?.[1]) return null
  const parsed = githubIssueErrorCodeSchema.safeParse(match[1])
  return parsed.success ? parsed.data : null
}

export function truncateIssueBodyForDraft(
  body: string,
  max = GITHUB_ISSUE_TASK_DRAFT_BODY_MAX,
): string {
  if (body.length <= max) return body
  return `${body.slice(0, max).trimEnd()}\n\n(truncated)`
}

export function buildIssueTaskDraft(issue: GitHubIssueView): string {
  const repoSlug = `${issue.repository.owner}/${issue.repository.name}`
  const body = truncateIssueBodyForDraft(issue.body)
  return `[GitHub Issue] ${repoSlug}#${issue.number}: ${issue.title}

Source:
${issue.url}

Issue body:
${body}`
}

export function buildIssueTaskTitle(issue: GitHubIssueView): string {
  return `[${formatIssueRefKey(issue.repository, issue.number)}] ${issue.title}`
}

const ISSUE_REF_TASK_TITLE_PREFIX = /^\[([^/]+)\/([^#]+)#(\d+)\]\s/
const ISSUE_REF_KEY_PATTERN = /^([^/]+)\/([^#]+)#(\d+)$/

/** Stable key for issue list rows and task title correlation. */
export function formatIssueRefKey(
  repository: { owner: string; name: string },
  number: number,
): string {
  return `${repository.owner}/${repository.name}#${number}`
}

export function parseIssueRefKey(
  ref: string,
): { owner: string; name: string; number: number } | null {
  const match = ref.trim().match(ISSUE_REF_KEY_PATTERN)
  if (!match) return null
  const owner = match[1]?.trim()
  const name = match[2]?.trim()
  const number = Number(match[3])
  if (!owner || !name || !Number.isInteger(number) || number <= 0) return null
  return { owner, name, number }
}

/** Parses Issue ref prefix from task title; returns null when format does not match. */
export function parseIssueRefFromTaskTitle(
  title: string,
): { owner: string; name: string; number: number } | null {
  const match = title.match(ISSUE_REF_TASK_TITLE_PREFIX)
  if (!match) return null
  const owner = match[1]?.trim()
  const name = match[2]?.trim()
  const number = Number(match[3])
  if (!owner || !name || !Number.isInteger(number) || number <= 0) return null
  return { owner, name, number }
}

export function normalizeIssueNumber(value: unknown): number | undefined {
  if (!Number.isInteger(value) || (value as number) <= 0) return undefined
  return value as number
}

export function normalizeIssueRef(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const parsed = parseIssueRefKey(value)
  return parsed ? formatIssueRefKey(parsed, parsed.number) : undefined
}

export function resolveTaskIssueRef(task: {
  issueRef?: string
  title: string
}): string | undefined {
  const explicit = normalizeIssueRef(task.issueRef)
  if (explicit !== undefined) return explicit
  const parsed = parseIssueRefFromTaskTitle(task.title)
  return parsed ? formatIssueRefKey(parsed, parsed.number) : undefined
}

/**
 * Preferred source is explicit task metadata; falls back to the legacy title prefix.
 * This preserves compatibility for older rows while new tasks use a real internal field.
 */
export function resolveTaskIssueNumber(task: {
  issueRef?: string
  issueNumber?: number
  title: string
}): number | undefined {
  const explicit = normalizeIssueNumber(task.issueNumber)
  if (explicit !== undefined) return explicit
  const explicitRef = parseIssueRefKey(normalizeIssueRef(task.issueRef) ?? '')
  if (explicitRef) return explicitRef.number
  return parseIssueRefFromTaskTitle(task.title)?.number
}
