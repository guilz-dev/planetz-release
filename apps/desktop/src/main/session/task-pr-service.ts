import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type CreateResultPrInput,
  type CreateResultPrResult,
  formatTaskPrErrorMessage,
  type GitHubIssueRepository,
  ORBIT_TAKT_GLOBAL_DIRNAME,
  parseIssueRefKey,
  type ResultCheckBranchResult,
  resolveTaskIssueNumber,
  resolveTaskIssueRef,
  type TaskPrErrorCode,
  type TaskPrSummary,
  type TaskResultBundle,
  type TaskViewModel,
} from '@planetz/shared'
import { execa } from 'execa'
import { parse as parseYaml } from 'yaml'
import {
  ghCliOutputLooksLikeAuthRequired,
  ghCliOutputLooksLikePermissionDenied,
} from '../lib/gh-cli-error-patterns.js'
import { gitBranchExists, rejectInvalidGitBranchName } from '../lib/git-branch-exists.js'
import { readGitHubRepoFromWorkspaceOrigin } from '../lib/github-remote-url.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { TaskPrLinkStore } from '../sidecar/task-pr-link-store.js'

export interface TaskPrServiceContext {
  mockQueueEnabled: () => boolean
  requireTaktRepoPath: () => string
  requireSidecarPaths: () => SidecarPaths
  readTaktTasksFresh: () => Promise<TaskViewModel[]>
  readTaskResultBundle?: (taskId: string) => Promise<TaskResultBundle | null>
  readTaktProjectConfigYaml?: () => Promise<string | null>
}

interface GhPrJson {
  number: number
  url: string
  state: string
  isDraft?: boolean
  baseRefName?: string
  headRefName?: string
}

interface GhRepoJson {
  defaultBranchRef?: { name?: string }
}

interface GhRepoApiJson extends GhRepoJson {
  default_branch?: string
}

interface GhRestPrJson {
  number: number
  html_url?: string
  state?: string
  draft?: boolean
  base?: { ref?: string }
  head?: { ref?: string }
  merged_at?: string | null
}

interface GhIssueJson {
  number?: number
  title?: string
  body?: string
}

interface TaskIssueTarget {
  owner: string
  name: string
  number: number
}

interface PrIssueSummary {
  number: number
  title: string
  body: string
}

interface TaktProjectConfigRaw {
  pipeline?: {
    pr_body_template?: unknown
    prBodyTemplate?: unknown
  }
}

const GITHUB_PR_URL_RE = /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+\/?/i
const PR_BODY_MAX_CHARS = 60_000
const PR_REPORT_MAX_CHARS = 20_000
const TRUNCATED_MARKER = '\n\n(truncated)'

function throwPrError(code: TaskPrErrorCode, detail?: string): never {
  throw new Error(formatTaskPrErrorMessage(code, detail))
}

function readExecText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function normalizeGhPrState(raw: string): TaskPrSummary['state'] {
  const upper = raw.toUpperCase()
  if (upper === 'MERGED') return 'merged'
  if (upper === 'CLOSED') return 'closed'
  return 'open'
}

function mapGhFailure(stderr: string, stdout: string): TaskPrErrorCode {
  const combined = `${stderr}\n${stdout}`.toLowerCase()
  if (combined.includes('unknown flag')) {
    return 'pr_create_failed'
  }
  if (ghCliOutputLooksLikeAuthRequired(combined)) {
    return 'gh_auth_required'
  }
  if (ghCliOutputLooksLikePermissionDenied(combined)) {
    return 'permission_denied'
  }
  return 'pr_create_failed'
}

function clampPrText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trimEnd()}${TRUNCATED_MARKER}`
}

function expandPrBodyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

function parsePipelinePrBodyTemplate(rawYaml: string | null): string | undefined {
  if (!rawYaml) return undefined
  try {
    const parsed = parseYaml(rawYaml) as TaktProjectConfigRaw
    const template = parsed.pipeline?.pr_body_template ?? parsed.pipeline?.prBodyTemplate
    if (typeof template !== 'string') return undefined
    return template.trim().length > 0 ? template : undefined
  } catch {
    return undefined
  }
}

function resolveTaskIssueTarget(
  task: TaskViewModel,
  repo: GitHubIssueRepository,
): TaskIssueTarget | null {
  const explicitIssueRef = resolveTaskIssueRef(task)
  if (explicitIssueRef) {
    const parsed = parseIssueRefKey(explicitIssueRef)
    if (parsed) {
      return parsed
    }
  }
  const issueNumber = resolveTaskIssueNumber(task)
  if (!issueNumber) return null
  return {
    owner: repo.owner,
    name: repo.name,
    number: issueNumber,
  }
}

function defaultExecutionReport(task: TaskViewModel): string {
  const workflow = typeof task.workflow === 'string' ? task.workflow.trim() : ''
  return workflow
    ? `Workflow \`${workflow}\` completed successfully.`
    : 'Task completed successfully.'
}

function pickPrimaryReportContent(bundle: TaskResultBundle | null): string | undefined {
  if (!bundle || bundle.status !== 'ok' || bundle.reports.length === 0) return undefined
  const fallbackIndex = bundle.reports.length - 1
  const primaryIndex =
    typeof bundle.primaryIndex === 'number' &&
    bundle.primaryIndex >= 0 &&
    bundle.primaryIndex < bundle.reports.length
      ? bundle.primaryIndex
      : fallbackIndex
  const content = bundle.reports[primaryIndex]?.content?.trim()
  if (!content || content.length === 0) return undefined
  return content
}

function buildFallbackPrBody(input: {
  summary?: string
  report: string
  closesRef?: string
}): string {
  const parts: string[] = []
  const summary = input.summary?.trim()

  parts.push('## Summary')
  if (summary) {
    parts.push('')
    parts.push(summary)
  }

  parts.push('')
  parts.push('## Execution Report')
  parts.push('')
  parts.push(input.report)

  if (input.closesRef && input.closesRef.trim().length > 0) {
    parts.push('')
    parts.push(`Closes ${input.closesRef}`)
  }

  return clampPrText(parts.join('\n'), PR_BODY_MAX_CHARS)
}

function readIssueSummary(json: GhIssueJson, fallback: TaskIssueTarget): PrIssueSummary {
  const number =
    typeof json.number === 'number' && Number.isInteger(json.number) && json.number > 0
      ? json.number
      : fallback.number
  return {
    number,
    title: typeof json.title === 'string' ? json.title : '',
    body: typeof json.body === 'string' ? json.body : '',
  }
}

function resolveIssueClosesRef(
  issue: TaskIssueTarget | null,
  prRepo: GitHubIssueRepository,
): string | undefined {
  if (!issue) return undefined
  const sameRepo = issue.owner === prRepo.owner && issue.name === prRepo.name
  return sameRepo ? `#${issue.number}` : `${issue.owner}/${issue.name}#${issue.number}`
}

function parseCreatedPrUrl(stdout: string): string | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  const direct = trimmed.match(GITHUB_PR_URL_RE)
  if (direct?.[0]) return direct[0].replace(/\/$/, '')
  for (const line of trimmed.split('\n')) {
    const match = line.trim().match(GITHUB_PR_URL_RE)
    if (match?.[0]) return match[0].replace(/\/$/, '')
  }
  return null
}

async function fetchGhPrByUrl(repoSlug: string, url: string): Promise<GhPrJson | null> {
  const match = url.match(/\/pull\/(\d+)\/?$/i)
  const number = match ? Number.parseInt(match[1], 10) : Number.NaN
  if (!Number.isInteger(number) || number <= 0) return null

  let ghResult: Awaited<ReturnType<typeof execa>>
  try {
    ghResult = await execa('gh', ['api', `repos/${repoSlug}/pulls/${number}`], { reject: false })
  } catch {
    return null
  }

  if (ghResult.exitCode !== 0) return null

  try {
    const parsed = JSON.parse(readExecText(ghResult.stdout)) as GhRestPrJson
    return ghRestPrToJson(parsed)
  } catch {
    return null
  }
}

function ghPrFromCreateFallback(
  url: string,
  branch: string,
  baseBranch: string,
  draft: boolean,
): GhPrJson | null {
  const match = url.match(/\/pull\/(\d+)\/?$/i)
  const number = match ? Number.parseInt(match[1], 10) : Number.NaN
  if (!Number.isInteger(number) || number <= 0) return null
  return {
    number,
    url,
    state: 'OPEN',
    isDraft: draft,
    baseRefName: baseBranch,
    headRefName: branch,
  }
}

async function readOriginDefaultBranch(taktRepo: string): Promise<string | null> {
  const result = await execa('git', ['-C', taktRepo, 'symbolic-ref', 'refs/remotes/origin/HEAD'], {
    reject: false,
  })
  if (result.exitCode !== 0) return null
  const ref = result.stdout.trim()
  const prefix = 'refs/remotes/origin/'
  if (!ref.startsWith(prefix)) return null
  const branch = ref.slice(prefix.length).trim()
  return branch.length > 0 ? branch : null
}

async function readRemoteShowDefaultBranch(taktRepo: string): Promise<string | null> {
  const result = await execa('git', ['-C', taktRepo, 'remote', 'show', 'origin'], { reject: false })
  if (result.exitCode !== 0) return null
  const match = result.stdout.match(/^\s*HEAD branch:\s+(.+)$/m)
  const branch = match?.[1]?.trim()
  return branch ? branch : null
}

function ghRestPrToJson(pr: GhRestPrJson): GhPrJson | null {
  const url = pr.html_url?.trim()
  if (!url) return null

  return {
    number: pr.number,
    url,
    state: pr.merged_at ? 'MERGED' : pr.state?.toUpperCase() || 'OPEN',
    isDraft: pr.draft,
    baseRefName: pr.base?.ref,
    headRefName: pr.head?.ref,
  }
}

async function resolveDefaultBaseBranch(
  taktRepo: string,
  repo: GitHubIssueRepository,
): Promise<string> {
  const fromOrigin = await readOriginDefaultBranch(taktRepo)
  if (fromOrigin) return fromOrigin

  const fromRemoteShow = await readRemoteShowDefaultBranch(taktRepo)
  if (fromRemoteShow) return fromRemoteShow

  const repoSlug = `${repo.owner}/${repo.name}`
  let ghResult: Awaited<ReturnType<typeof execa>>
  try {
    ghResult = await execa('gh', ['api', `repos/${repoSlug}`], { reject: false })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code === 'ENOENT') throwPrError('gh_not_found')
    throwPrError('unexpected_failure', error instanceof Error ? error.message : undefined)
  }

  if (ghResult.exitCode !== 0) {
    const stderr = readExecText(ghResult.stderr)
    const stdout = readExecText(ghResult.stdout)
    throwPrError(mapGhFailure(stderr, stdout), stderr.trim() || stdout.trim() || undefined)
  }

  try {
    const parsed = JSON.parse(readExecText(ghResult.stdout)) as GhRepoApiJson
    const name = parsed.default_branch?.trim() ?? parsed.defaultBranchRef?.name?.trim()
    if (name) return name
  } catch {
    throwPrError('unexpected_failure', 'Failed to parse GitHub repository metadata')
  }

  throwPrError('unexpected_failure', 'Default branch could not be resolved')
}

async function remoteBranchExists(taktRepo: string, branch: string): Promise<boolean> {
  const result = await execa('git', ['-C', taktRepo, 'ls-remote', '--heads', 'origin', branch], {
    reject: false,
  })
  return result.exitCode === 0 && result.stdout.trim().length > 0
}

function ghPrToSummary(pr: GhPrJson, branch: string, baseBranch: string): TaskPrSummary {
  return {
    number: pr.number,
    url: pr.url,
    state: normalizeGhPrState(pr.state),
    isDraft: Boolean(pr.isDraft),
    headBranch: pr.headRefName?.trim() || branch,
    baseBranch: pr.baseRefName?.trim() || baseBranch,
  }
}

async function persistTaskPrLink(
  store: TaskPrLinkStore,
  paths: SidecarPaths,
  input: {
    taskId: string
    branch: string
    repo: string
    pr: TaskPrSummary
  },
): Promise<void> {
  const saved = await store.upsert(paths, input)
  if (!saved) {
    throwPrError('unexpected_failure', 'Failed to persist pull request link')
  }
}

export class TaskPrService {
  constructor(private readonly taskPrLinkStore: TaskPrLinkStore) {}

  private async readTaktGlobalConfigYaml(context: TaskPrServiceContext): Promise<string | null> {
    try {
      const sidecarRoot = context.requireSidecarPaths().root
      const configPath = join(sidecarRoot, ORBIT_TAKT_GLOBAL_DIRNAME, 'config.yaml')
      return await readFile(configPath, 'utf8')
    } catch {
      return null
    }
  }

  private async resolvePipelinePrBodyTemplate(
    context: TaskPrServiceContext,
  ): Promise<string | undefined> {
    const projectTemplate = parsePipelinePrBodyTemplate(
      (await context.readTaktProjectConfigYaml?.()) ?? null,
    )
    if (projectTemplate) return projectTemplate
    const globalTemplate = parsePipelinePrBodyTemplate(await this.readTaktGlobalConfigYaml(context))
    return globalTemplate
  }

  private async resolveExecutionReport(
    context: TaskPrServiceContext,
    task: TaskViewModel,
  ): Promise<string> {
    const fallback = defaultExecutionReport(task)
    if (!context.readTaskResultBundle) return fallback
    try {
      const bundle = await context.readTaskResultBundle(task.id)
      const content = pickPrimaryReportContent(bundle)
      return content ? clampPrText(content, PR_REPORT_MAX_CHARS) : fallback
    } catch {
      return fallback
    }
  }

  private async fetchIssueSummary(issue: TaskIssueTarget | null): Promise<PrIssueSummary | null> {
    if (!issue) return null
    try {
      const endpoint = `repos/${issue.owner}/${issue.name}/issues/${issue.number}`
      const ghResult = await execa('gh', ['api', endpoint], { reject: false })
      if (ghResult.exitCode !== 0) return null
      const parsed = JSON.parse(readExecText(ghResult.stdout)) as GhIssueJson
      return readIssueSummary(parsed, issue)
    } catch {
      return null
    }
  }

  private async resolvePrBody(input: {
    context: TaskPrServiceContext
    task: TaskViewModel
    repo: GitHubIssueRepository
    title: string
    body: string | undefined
  }): Promise<string> {
    const providedBody =
      typeof input.body === 'string' && input.body.trim().length > 0 ? input.body : undefined
    if (providedBody) return providedBody

    const issueTarget = resolveTaskIssueTarget(input.task, input.repo)
    const issue = await this.fetchIssueSummary(issueTarget)
    const report = await this.resolveExecutionReport(input.context, input.task)

    const template = await this.resolvePipelinePrBodyTemplate(input.context)
    if (template) {
      const templateBody = expandPrBodyTemplate(template, {
        title: issue?.title ?? '',
        issue: String(issue?.number ?? issueTarget?.number ?? ''),
        issue_body: issue?.body || issue?.title || '',
        report,
      })
      if (templateBody.trim().length > 0) {
        return clampPrText(templateBody, PR_BODY_MAX_CHARS)
      }
    }

    const summary =
      issue?.body?.trim() ||
      issue?.title?.trim() ||
      input.task.body?.trim() ||
      input.task.title.trim()
    const normalizedIssue = issueTarget
      ? { ...issueTarget, number: issue?.number ?? issueTarget.number }
      : null
    const closesRef = resolveIssueClosesRef(normalizedIssue, input.repo)
    return buildFallbackPrBody({ summary, report, closesRef })
  }

  async checkBranch(
    context: TaskPrServiceContext,
    branch: string,
  ): Promise<ResultCheckBranchResult> {
    if (context.mockQueueEnabled()) {
      return { exists: false }
    }

    const taktRepo = context.requireTaktRepoPath()
    const trimmed = rejectInvalidGitBranchName(branch)
    const exists = await gitBranchExists(taktRepo, trimmed)
    if (!exists) {
      return { exists: false }
    }

    const repo = await readGitHubRepoFromWorkspaceOrigin(taktRepo)
    if (!repo) {
      return { exists: true }
    }

    try {
      const defaultBaseBranch = await resolveDefaultBaseBranch(taktRepo, repo)
      return { exists: true, defaultBaseBranch }
    } catch {
      return { exists: true }
    }
  }

  async create(
    context: TaskPrServiceContext,
    input: CreateResultPrInput,
  ): Promise<CreateResultPrResult> {
    if (context.mockQueueEnabled()) {
      throwPrError('unexpected_failure', 'Create PR is not available in mock queue mode')
    }

    const taktRepo = context.requireTaktRepoPath()
    const paths = context.requireSidecarPaths()
    const branch = rejectInvalidGitBranchName(input.branch)

    const tasks = await context.readTaktTasksFresh()
    const task = tasks.find((row) => row.id === input.taskId)
    if (!task || task.status !== 'completed') {
      throwPrError('branch_not_found')
    }
    const expectedBranch = task.sourceBranch?.trim()
    if (!expectedBranch || expectedBranch !== branch) {
      throwPrError('branch_not_found')
    }

    if (!(await gitBranchExists(taktRepo, branch))) {
      throwPrError('branch_not_found')
    }

    const repo = await readGitHubRepoFromWorkspaceOrigin(taktRepo)
    if (!repo) {
      throwPrError('repo_not_supported')
    }

    const repoSlug = `${repo.owner}/${repo.name}`
    const baseBranch = input.baseBranch?.trim() || (await resolveDefaultBaseBranch(taktRepo, repo))
    const pushIfNeeded = input.pushIfNeeded !== false

    if (!(await remoteBranchExists(taktRepo, branch))) {
      if (!pushIfNeeded) {
        throwPrError('push_required')
      }
      const pushResult = await execa('git', ['-C', taktRepo, 'push', '-u', 'origin', branch], {
        reject: false,
      })
      if (pushResult.exitCode !== 0) {
        const stderr = readExecText(pushResult.stderr)
        throwPrError('push_failed', stderr.trim() || undefined)
      }
    }

    const existing = await this.findExistingPr(repo, branch)
    if (existing) {
      const pr = ghPrToSummary(existing, branch, baseBranch)
      await persistTaskPrLink(this.taskPrLinkStore, paths, {
        taskId: input.taskId,
        branch,
        repo: repoSlug,
        pr,
      })
      return { status: 'already_exists', pr }
    }

    const title = input.title?.trim() || task.title.trim() || branch
    const body = await this.resolvePrBody({
      context,
      task,
      repo,
      title,
      body: input.body,
    })
    const draft = input.draft === true

    const createArgs = [
      'pr',
      'create',
      '--repo',
      repoSlug,
      '--base',
      baseBranch,
      '--head',
      branch,
      '--title',
      title,
      '--body',
      body,
    ]
    if (draft) createArgs.push('--draft')

    let ghResult: Awaited<ReturnType<typeof execa>>
    try {
      ghResult = await execa('gh', createArgs, { reject: false })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'ENOENT') throwPrError('gh_not_found')
      throwPrError('unexpected_failure', error instanceof Error ? error.message : undefined)
    }

    if (ghResult.exitCode !== 0) {
      const stderr = readExecText(ghResult.stderr)
      const stdout = readExecText(ghResult.stdout)
      throwPrError(mapGhFailure(stderr, stdout), stderr.trim() || stdout.trim() || undefined)
    }

    const prUrl = parseCreatedPrUrl(readExecText(ghResult.stdout))
    if (!prUrl) {
      throwPrError('pr_create_failed', 'gh pr create did not return a pull request URL')
    }

    const parsed =
      (await fetchGhPrByUrl(repoSlug, prUrl)) ??
      ghPrFromCreateFallback(prUrl, branch, baseBranch, draft)
    if (!parsed) {
      throwPrError('pr_create_failed', 'Failed to load created pull request metadata')
    }

    const pr = ghPrToSummary(parsed, branch, baseBranch)
    await persistTaskPrLink(this.taskPrLinkStore, paths, {
      taskId: input.taskId,
      branch,
      repo: repoSlug,
      pr,
    })
    return { status: 'created', pr }
  }

  private async findExistingPr(
    repo: GitHubIssueRepository,
    branch: string,
  ): Promise<GhPrJson | null> {
    const head = `${repo.owner}:${branch}`
    const query = new URLSearchParams({ head, state: 'all', per_page: '1' })
    const endpoint = `repos/${repo.owner}/${repo.name}/pulls?${query.toString()}`

    let ghResult: Awaited<ReturnType<typeof execa>>
    try {
      ghResult = await execa('gh', ['api', endpoint], { reject: false })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'ENOENT') throwPrError('gh_not_found')
      throwPrError('unexpected_failure', error instanceof Error ? error.message : undefined)
    }

    if (ghResult.exitCode !== 0) {
      const stderr = readExecText(ghResult.stderr)
      const stdout = readExecText(ghResult.stdout)
      throwPrError(mapGhFailure(stderr, stdout), stderr.trim() || stdout.trim() || undefined)
    }

    try {
      const rows = JSON.parse(readExecText(ghResult.stdout)) as GhRestPrJson[]
      const first = rows[0]
      return first ? ghRestPrToJson(first) : null
    } catch {
      throwPrError('unexpected_failure', 'Failed to parse GitHub pull request list')
    }
  }
}
