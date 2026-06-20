import { isAbsolute, normalize } from 'node:path'
import type {
  DiffFileStatus,
  TaskResultDiffFile,
  TaskResultDiffSummary,
  UiConfig,
} from '@planetz/shared'
import {
  TASK_RESULT_DIFF_CACHE_SIZE,
  TASK_RESULT_DIFF_MAX_FILE_BYTES,
  TASK_RESULT_DIFF_MAX_FILES,
  TASK_RESULT_DIFF_MAX_TOTAL_BYTES,
} from '@planetz/shared'
import { execa } from 'execa'
import { isGitBranchFormatValid, rejectInvalidGitBranchName } from '../lib/git-branch-exists.js'
import { detectGitDefaultBranch } from '../lib/git-default-branch.js'
import { parseGitUnifiedDiff } from '../lib/git-unified-diff-parser.js'
import {
  BRANCH_NOT_READY_ERROR_CODE,
  prepareTaskBranchForRoot,
} from '../lib/prepare-task-branch-for-root.js'

interface DiffContext {
  taktRepoPath: string
  config: UiConfig
}

interface SummaryRow {
  path: string
  oldPath?: string
  status: DiffFileStatus
  additions: number
  deletions: number
  binary?: boolean
}

interface ListedRows {
  branch: string
  baseRef: string
  rows: SummaryRow[]
  truncated: boolean
}

function toErrorMessage(result: { stderr: string; stdout: string }, fallback: string): string {
  return result.stderr.trim() || result.stdout.trim() || fallback
}

function ensureRelativePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) throw new Error('Invalid diff path')
  if (isAbsolute(trimmed)) throw new Error('Invalid diff path')
  if (trimmed.split('/').includes('..')) throw new Error('Invalid diff path')
  const normalized = normalize(trimmed).replaceAll('\\', '/')
  if (normalized === '..' || normalized.startsWith('../')) throw new Error('Invalid diff path')
  return normalized
}

function mapNameStatusToken(token: string): DiffFileStatus {
  if (token.startsWith('R')) return 'renamed'
  switch (token[0]) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    default:
      return 'modified'
  }
}

function parseNameStatus(
  output: string,
): Array<{ path: string; oldPath?: string; status: DiffFileStatus }> {
  const rows: Array<{ path: string; oldPath?: string; status: DiffFileStatus }> = []
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cols = line.split('\t')
    if (cols.length < 2) continue
    const token = cols[0]
    const status = mapNameStatusToken(token)
    if (status === 'renamed' && cols.length >= 3) {
      rows.push({ oldPath: cols[1], path: cols[2], status })
      continue
    }
    rows.push({ path: cols[1], status })
  }
  return rows
}

async function readNumstat(input: {
  repoPath: string
  baseRef: string
  branch: string
  path: string
  oldPath?: string
}): Promise<{ additions: number; deletions: number; binary: boolean }> {
  const targets = input.oldPath ? [input.oldPath, input.path] : [input.path]
  const result = await execa(
    'git',
    ['diff', '--numstat', '--find-renames', `${input.baseRef}...${input.branch}`, '--', ...targets],
    {
      cwd: input.repoPath,
      reject: false,
    },
  )
  if (result.exitCode !== 0) {
    throw new Error(toErrorMessage(result, 'Failed to read diff stat'))
  }
  const firstLine = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (!firstLine) return { additions: 0, deletions: 0, binary: false }
  const [addRaw = '0', delRaw = '0'] = firstLine.split('\t')
  if (addRaw === '-' || delRaw === '-') return { additions: 0, deletions: 0, binary: true }
  return {
    additions: Number.parseInt(addRaw, 10) || 0,
    deletions: Number.parseInt(delRaw, 10) || 0,
    binary: false,
  }
}

async function ensureBranchReady(
  context: DiffContext,
  taskId: string,
  branch: string,
): Promise<string> {
  const trimmed = rejectInvalidGitBranchName(branch)
  if (!(await isGitBranchFormatValid(context.taktRepoPath, trimmed))) {
    throw new Error('Invalid branch name')
  }
  await prepareTaskBranchForRoot({
    taktRepoPath: context.taktRepoPath,
    config: context.config,
    taskId,
    branch: trimmed,
  })
  return trimmed
}

function toSummaryRow(
  entry: { path: string; oldPath?: string; status: DiffFileStatus },
  stat: { additions: number; deletions: number; binary: boolean },
): SummaryRow {
  const status = stat.binary ? 'binary' : entry.status
  return {
    path: entry.path,
    oldPath: entry.oldPath,
    status,
    additions: stat.additions,
    deletions: stat.deletions,
    binary: stat.binary || undefined,
  }
}

function maybeRenameOnlyMeta(
  row: SummaryRow,
  lines: TaskResultDiffFile['lines'],
): TaskResultDiffFile['lines'] {
  if (lines.length > 0) return lines
  if (row.status === 'renamed' && row.additions === 0 && row.deletions === 0) {
    return [{ kind: 'meta', text: 'File renamed without content changes.' }]
  }
  return lines
}

function cacheKey(repoPath: string, baseRef: string, branch: string, path: string): string {
  return `${repoPath}::${baseRef}::${branch}::${path}`
}

export class ResultDiffService {
  private readonly fileCache = new Map<string, TaskResultDiffFile>()
  private readonly summaryCache = new Map<string, ListedRows>()

  private remember(key: string, value: TaskResultDiffFile): void {
    if (this.fileCache.has(key)) {
      this.fileCache.delete(key)
    }
    this.fileCache.set(key, value)
    while (this.fileCache.size > TASK_RESULT_DIFF_CACHE_SIZE) {
      const oldest = this.fileCache.keys().next().value
      if (!oldest) return
      this.fileCache.delete(oldest)
    }
  }

  private rememberSummary(key: string, value: ListedRows): void {
    if (this.summaryCache.has(key)) {
      this.summaryCache.delete(key)
    }
    this.summaryCache.set(key, value)
    while (this.summaryCache.size > TASK_RESULT_DIFF_CACHE_SIZE) {
      const oldest = this.summaryCache.keys().next().value
      if (!oldest) return
      this.summaryCache.delete(oldest)
    }
  }

  private summaryKey(repoPath: string, taskId: string, branch: string): string {
    return `${repoPath}::${taskId}::${branch}`
  }

  private async listRows(
    context: DiffContext,
    taskId: string,
    branch: string,
  ): Promise<ListedRows> {
    const readyBranch = await ensureBranchReady(context, taskId, branch)
    const baseRef = await detectGitDefaultBranch(context.taktRepoPath)
    const nameStatus = await execa(
      'git',
      ['diff', '--name-status', '--find-renames', `${baseRef}...${readyBranch}`],
      {
        cwd: context.taktRepoPath,
        reject: false,
      },
    )
    if (nameStatus.exitCode !== 0) {
      throw new Error(toErrorMessage(nameStatus, 'Failed to read changed files'))
    }
    const entries = parseNameStatus(nameStatus.stdout)
    const truncated = entries.length > TASK_RESULT_DIFF_MAX_FILES
    const limited = entries.slice(0, TASK_RESULT_DIFF_MAX_FILES)
    const rows: SummaryRow[] = []
    for (const entry of limited) {
      const stat = await readNumstat({
        repoPath: context.taktRepoPath,
        baseRef,
        branch: readyBranch,
        path: entry.path,
        oldPath: entry.oldPath,
      })
      rows.push(toSummaryRow(entry, stat))
    }
    return { branch: readyBranch, baseRef, rows, truncated }
  }

  private async getListedRows(
    context: DiffContext,
    taskId: string,
    branch: string,
    forceRefresh: boolean,
  ): Promise<ListedRows> {
    const trimmed = rejectInvalidGitBranchName(branch)
    const key = this.summaryKey(context.taktRepoPath, taskId, trimmed)
    if (!forceRefresh) {
      const cached = this.summaryCache.get(key)
      if (cached) return cached
    }
    const listed = await this.listRows(context, taskId, trimmed)
    this.rememberSummary(key, listed)
    return listed
  }

  async listTaskResultDiff(
    context: DiffContext,
    input: { taskId: string; branch: string },
  ): Promise<TaskResultDiffSummary> {
    const listed = await this.getListedRows(context, input.taskId, input.branch, true)
    return {
      taskId: input.taskId,
      branch: listed.branch,
      baseRef: listed.baseRef,
      files: listed.rows,
      truncated: listed.truncated || undefined,
    }
  }

  async getTaskResultDiffFile(
    context: DiffContext,
    input: { taskId: string; branch: string; path: string },
  ): Promise<TaskResultDiffFile> {
    const targetPath = ensureRelativePath(input.path)
    const listed = await this.getListedRows(context, input.taskId, input.branch, false)
    const row = listed.rows.find((entry) => entry.path === targetPath)
    if (!row) {
      throw new Error(`Diff file not found: ${targetPath}`)
    }
    const key = cacheKey(context.taktRepoPath, listed.baseRef, listed.branch, row.path)
    const cached = this.fileCache.get(key)
    if (cached) return cached

    if (row.status === 'binary' || row.binary) {
      const payload: TaskResultDiffFile = {
        path: row.path,
        oldPath: row.oldPath,
        status: 'binary',
        lines: [],
        additions: row.additions,
        deletions: row.deletions,
        binary: true,
      }
      this.remember(key, payload)
      return payload
    }

    const targets = row.oldPath ? [row.oldPath, row.path] : [row.path]
    const diffResult = await execa(
      'git',
      [
        'diff',
        '--no-color',
        '--unified=3',
        '--find-renames',
        `${listed.baseRef}...${listed.branch}`,
        '--',
        ...targets,
      ],
      {
        cwd: context.taktRepoPath,
        reject: false,
      },
    )
    if (diffResult.exitCode !== 0) {
      throw new Error(toErrorMessage(diffResult, 'Failed to read file diff'))
    }

    const { lines, truncated } = parseGitUnifiedDiff(
      diffResult.stdout,
      Math.min(TASK_RESULT_DIFF_MAX_FILE_BYTES, TASK_RESULT_DIFF_MAX_TOTAL_BYTES),
    )
    const payload: TaskResultDiffFile = {
      path: row.path,
      oldPath: row.oldPath,
      status: row.status,
      lines: maybeRenameOnlyMeta(row, lines),
      additions: row.additions,
      deletions: row.deletions,
      binary: row.binary,
      truncated: truncated || undefined,
    }
    this.remember(key, payload)
    return payload
  }
}

export function isBranchNotReadyMessage(message: string): boolean {
  return message.startsWith(`${BRANCH_NOT_READY_ERROR_CODE}:`)
}
