import {
  formatGitHubIssueErrorMessage,
  GITHUB_ISSUE_LIST_OPEN_PAGE_SIZE,
  type GitHubIssueErrorCode,
  type GitHubIssueFetchInput,
  type GitHubIssueListItem,
  type GitHubIssueListOpenInput,
  type GitHubIssueListOpenResult,
  type GitHubIssueView,
} from '@planetz/shared'
import { execa } from 'execa'
import {
  ghCliOutputLooksLikeAuthRequired,
  ghCliOutputLooksLikePermissionDenied,
} from '../lib/gh-cli-error-patterns.js'
import { readGitHubRepoFromWorkspaceOrigin } from '../lib/github-remote-url.js'

export interface GitHubIssueFetchContext {
  workspacePath: string | null
}

interface ResolvedIssueRef {
  owner: string
  name: string
  number: number
}

interface GhIssueJson {
  number: number
  title: string
  body: string
  url: string
  state: string
  labels: Array<{ name?: string }>
  author?: { login?: string }
}

interface GhIssueListNodeJson {
  number: number
  title: string
  url: string
  createdAt: string
  state: string
  labels?: { nodes?: Array<{ name?: string }> }
  author?: { login?: string }
}

interface GhIssueListGraphqlJson {
  data?: {
    repository?: {
      issues?: {
        nodes?: GhIssueListNodeJson[]
        pageInfo?: { endCursor?: string | null; hasNextPage?: boolean }
      }
    }
  }
  errors?: Array<{ message?: string }>
}

function throwIssueError(code: GitHubIssueErrorCode, detail?: string): never {
  throw new Error(formatGitHubIssueErrorMessage(code, detail))
}

export { parseGitHubRemoteUrl } from '../lib/github-remote-url.js'

/** Normalizes Issue URL / owner/repo#N / #N into owner, repo, and number. */
export async function resolveGitHubIssueRef(
  ref: string,
  workspacePath: string | null,
): Promise<ResolvedIssueRef> {
  const trimmed = ref.trim()
  if (!trimmed) throwIssueError('invalid_issue_ref')

  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?(?:[#?].*)?$/i,
  )
  if (urlMatch) {
    const owner = urlMatch[1]?.trim()
    let name = urlMatch[2]?.trim() ?? ''
    const numberRaw = urlMatch[3]
    if (name.endsWith('.git')) name = name.slice(0, -'.git'.length)
    const number = Number(numberRaw)
    if (owner && name && Number.isInteger(number) && number > 0) {
      return { owner, name, number }
    }
    throwIssueError('invalid_issue_ref')
  }

  const shorthandMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)#(\d+)$/)
  if (shorthandMatch) {
    const owner = shorthandMatch[1]?.trim()
    let name = shorthandMatch[2]?.trim() ?? ''
    const number = Number(shorthandMatch[3])
    if (name.endsWith('.git')) name = name.slice(0, -'.git'.length)
    if (owner && name && Number.isInteger(number) && number > 0) {
      return { owner, name, number }
    }
    throwIssueError('invalid_issue_ref')
  }

  const localMatch = trimmed.match(/^#(\d+)$/)
  if (localMatch) {
    const number = Number(localMatch[1])
    if (!Number.isInteger(number) || number <= 0) throwIssueError('invalid_issue_ref')
    if (!workspacePath) throwIssueError('repo_required')
    const repo = await readGitHubRepoFromWorkspaceOrigin(workspacePath)
    if (!repo) throwIssueError('repo_required')
    return { owner: repo.owner, name: repo.name, number }
  }

  throwIssueError('invalid_issue_ref')
}

function readExecText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function normalizeGhState(raw: string): 'open' | 'closed' {
  return raw.toUpperCase() === 'CLOSED' ? 'closed' : 'open'
}

function mapGhFailure(
  stderr: string,
  stdout: string,
  exitCode: number | null,
): GitHubIssueErrorCode {
  const combined = `${stderr}\n${stdout}`.toLowerCase()
  if (ghCliOutputLooksLikeAuthRequired(combined)) {
    return 'gh_auth_required'
  }
  if (ghCliOutputLooksLikePermissionDenied(combined)) {
    return 'permission_denied'
  }
  if (
    combined.includes('repository not found') ||
    combined.includes('could not resolve to a repository')
  ) {
    return 'repo_required'
  }
  if (
    combined.includes('could not resolve') ||
    combined.includes('not found') ||
    combined.includes('404') ||
    exitCode === 1
  ) {
    return 'issue_not_found'
  }
  return 'unexpected_failure'
}

function collectIssueLabels(labels: Array<{ name?: string }> | undefined): string[] {
  return (labels ?? [])
    .map((label) => label.name?.trim())
    .filter((name): name is string => Boolean(name))
}

function mapIssueListNode(
  node: GhIssueListNodeJson,
  repository: { owner: string; name: string },
): GitHubIssueListItem {
  return {
    repository,
    number: node.number,
    title: node.title ?? '',
    url: node.url,
    createdAt: node.createdAt || new Date(0).toISOString(),
    state: normalizeGhState(node.state ?? 'OPEN'),
    labels: collectIssueLabels(node.labels?.nodes),
    author: node.author?.login?.trim() || undefined,
  }
}

const GH_LIST_OPEN_ISSUES_QUERY = `
query($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(
      states: OPEN
      first: $first
      after: $after
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      nodes {
        number
        title
        url
        createdAt
        state
        labels(first: 20) {
          nodes {
            name
          }
        }
        author {
          login
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}
`.trim()

export class GitHubIssueService {
  async listOpen(
    input: GitHubIssueListOpenInput,
    context: GitHubIssueFetchContext,
  ): Promise<GitHubIssueListOpenResult> {
    if (!context.workspacePath) throwIssueError('repo_required')
    const repository = await readGitHubRepoFromWorkspaceOrigin(context.workspacePath)
    if (!repository) throwIssueError('repo_required')

    const args = [
      'api',
      'graphql',
      '-f',
      `query=${GH_LIST_OPEN_ISSUES_QUERY}`,
      '-F',
      `owner=${repository.owner}`,
      '-F',
      `name=${repository.name}`,
      '-F',
      `first=${GITHUB_ISSUE_LIST_OPEN_PAGE_SIZE}`,
    ]
    if (input.after) {
      args.push('-F', `after=${input.after}`)
    }

    let ghResult: Awaited<ReturnType<typeof execa>>
    try {
      ghResult = await execa('gh', args, { reject: false })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'ENOENT') throwIssueError('gh_not_found')
      throwIssueError('unexpected_failure', error instanceof Error ? error.message : undefined)
    }

    if (ghResult.exitCode !== 0) {
      const stderr = readExecText(ghResult.stderr)
      const stdout = readExecText(ghResult.stdout)
      const code = mapGhFailure(stderr, stdout, ghResult.exitCode ?? null)
      throwIssueError(code, stderr.trim() || stdout.trim() || undefined)
    }

    let parsed: GhIssueListGraphqlJson
    try {
      parsed = JSON.parse(readExecText(ghResult.stdout)) as GhIssueListGraphqlJson
    } catch {
      throwIssueError('unexpected_failure', 'Failed to parse gh issue list JSON')
    }

    const graphqlErrors = (parsed.errors ?? [])
      .map((error) => error.message?.trim())
      .filter((message): message is string => Boolean(message))
    if (graphqlErrors.length > 0) {
      const detail = graphqlErrors.join(' | ')
      throwIssueError(mapGhFailure(detail, '', null), detail)
    }

    const issues = parsed.data?.repository?.issues
    if (!issues) throwIssueError('unexpected_failure', 'Repository issues payload is missing')

    const items = (issues.nodes ?? []).map((node) => mapIssueListNode(node, repository))
    return {
      repository,
      items,
      pageInfo: {
        endCursor: issues.pageInfo?.endCursor ?? null,
        hasNextPage: issues.pageInfo?.hasNextPage === true,
      },
    }
  }

  async fetch(
    input: GitHubIssueFetchInput,
    context: GitHubIssueFetchContext,
  ): Promise<GitHubIssueView> {
    const resolved = await resolveGitHubIssueRef(input.ref, context.workspacePath)
    const repoSlug = `${resolved.owner}/${resolved.name}`

    let ghResult: Awaited<ReturnType<typeof execa>>
    try {
      ghResult = await execa(
        'gh',
        [
          'issue',
          'view',
          String(resolved.number),
          '--repo',
          repoSlug,
          '--json',
          'number,title,body,url,state,labels,author',
        ],
        { reject: false },
      )
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === 'ENOENT') throwIssueError('gh_not_found')
      throwIssueError('unexpected_failure', error instanceof Error ? error.message : undefined)
    }

    if (ghResult.exitCode !== 0) {
      const stderr = readExecText(ghResult.stderr)
      const stdout = readExecText(ghResult.stdout)
      const code = mapGhFailure(stderr, stdout, ghResult.exitCode ?? null)
      throwIssueError(code, stderr.trim() || stdout.trim() || undefined)
    }

    let parsed: GhIssueJson
    try {
      parsed = JSON.parse(readExecText(ghResult.stdout)) as GhIssueJson
    } catch {
      throwIssueError('unexpected_failure', 'Failed to parse gh issue view JSON')
    }

    const labels = collectIssueLabels(parsed.labels)

    return {
      repository: { owner: resolved.owner, name: resolved.name },
      number: parsed.number,
      title: parsed.title ?? '',
      body: parsed.body ?? '',
      url: parsed.url,
      state: normalizeGhState(parsed.state ?? 'OPEN'),
      labels,
      author: parsed.author?.login?.trim() || undefined,
    }
  }
}
