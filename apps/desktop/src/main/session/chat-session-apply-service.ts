import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize } from 'node:path'
import type {
  ChatApplyEventPayload,
  ChatApplySessionMeta,
  ChatApplySkipReason,
  ChatSessionApplyChangesInput,
  ChatSessionApplyChangesResult,
  ChatSessionPendingChangeFileResult,
  ChatSessionPendingChangesResult,
  ChatSessionPendingFile,
  DiffFileStatus,
} from '@planetz/shared'
import {
  chatApplyEventPayloadSchema,
  TASK_RESULT_DIFF_MAX_FILE_BYTES,
  TASK_RESULT_DIFF_MAX_FILES,
} from '@planetz/shared'
import { execa } from 'execa'
import { parseGitUnifiedDiff } from '../lib/git-unified-diff-parser.js'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { upsertConversationArtifact } from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import { getChatApplySessionMeta } from './chat-apply-session-registry.js'
import {
  ChatSessionApplyMismatchError,
  ChatSessionApplyNotFoundError,
  ChatSessionApplyPolicyError,
} from './chat-session-apply-errors.js'

export type ChatSessionApplyServiceDeps = {
  requireWorkspacePath: () => string
  requireIsolatedRepoPath: () => string
  requireSidecarPaths: () => SidecarPaths
  ledgerStore: ConversationLedgerStore
}

type ResolvedApplyContext = {
  meta: ChatApplySessionMeta
  threadId: string
  composerSessionId: string
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

function parsePorcelainEntries(output: string): Array<{
  path: string
  oldPath?: string
  status: DiffFileStatus
}> {
  const tokens = output.split('\0').filter((token) => token.length > 0)
  const entries: Array<{ path: string; oldPath?: string; status: DiffFileStatus }> = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.length < 3) continue
    const xy = token.slice(0, 2)
    const pathToken = token.slice(3)
    if (!pathToken) continue
    if (xy === '??' || xy[1] === '?') {
      entries.push({ path: pathToken, status: 'added' })
      continue
    }
    if (xy[0] === 'R' || xy[1] === 'R' || xy[0] === 'C' || xy[1] === 'C') {
      const originalPath = tokens[index + 1]
      if (originalPath) {
        entries.push({ oldPath: originalPath, path: pathToken, status: 'renamed' })
        index += 1
      } else {
        entries.push({ path: pathToken, status: 'renamed' })
      }
      continue
    }
    if (xy.includes('D')) {
      entries.push({ path: pathToken, status: 'deleted' })
      continue
    }
    if (xy.includes('A')) {
      entries.push({ path: pathToken, status: 'added' })
      continue
    }
    entries.push({ path: pathToken, status: 'modified' })
  }
  return entries
}

async function isBinaryFileAtPath(filePath: string): Promise<boolean> {
  try {
    const body = await readFile(filePath)
    const sample = body.subarray(0, Math.min(body.byteLength, 8192))
    for (const byte of sample) {
      if (byte === 0) return true
    }
    return false
  } catch {
    return false
  }
}

async function readNumstatIsolated(
  isolatedRepoPath: string,
  path: string,
  oldPath?: string,
): Promise<{ additions: number; deletions: number; binary: boolean }> {
  const targets = oldPath ? [oldPath, path] : [path]
  const result = await execa('git', ['diff', '--numstat', 'HEAD', '--', ...targets], {
    cwd: isolatedRepoPath,
    reject: false,
  })
  if (result.exitCode !== 0) {
    return { additions: 0, deletions: 0, binary: false }
  }
  const firstLine = result.stdout
    .split('\n')
    .map((row) => row.trim())
    .find((row) => row.length > 0)
  if (!firstLine) return { additions: 0, deletions: 0, binary: false }
  const [addRaw = '0', delRaw = '0'] = firstLine.split('\t')
  if (addRaw === '-' || delRaw === '-') return { additions: 0, deletions: 0, binary: true }
  return {
    additions: Number.parseInt(addRaw, 10) || 0,
    deletions: Number.parseInt(delRaw, 10) || 0,
    binary: false,
  }
}

type WorkspaceConflictKind = 'none' | 'modified' | 'deleted_on_workspace' | 'renamed_on_workspace'

async function workspaceConflictSinceBase(
  workspacePath: string,
  baseRef: string,
  path: string,
): Promise<WorkspaceConflictKind> {
  const result = await execa('git', ['diff', '--name-status', baseRef, '--', path], {
    cwd: workspacePath,
    reject: false,
  })
  if (result.exitCode !== 0) {
    return 'modified'
  }
  const line = result.stdout
    .split('\n')
    .map((row) => row.trim())
    .find((row) => row.length > 0)
  if (!line) return 'none'
  const status = line[0]
  if (status === 'D') return 'deleted_on_workspace'
  if (status === 'R') return 'renamed_on_workspace'
  return 'modified'
}

function classifyFile(input: {
  entry: { path: string; oldPath?: string; status: DiffFileStatus }
  workspaceConflict: WorkspaceConflictKind
  isBinary: boolean
}): Pick<ChatSessionPendingFile, 'conflict' | 'applicable' | 'skipReason'> {
  const { entry, workspaceConflict, isBinary } = input
  if (entry.status === 'deleted') {
    return { conflict: false, applicable: false, skipReason: 'deleted_not_supported' }
  }
  if (entry.status === 'renamed') {
    return { conflict: false, applicable: false, skipReason: 'rename_requires_manual_apply' }
  }
  if (isBinary) {
    return { conflict: false, applicable: false, skipReason: 'binary_not_supported' }
  }
  if (workspaceConflict === 'deleted_on_workspace') {
    return { conflict: true, applicable: false, skipReason: 'deleted_on_workspace' }
  }
  if (workspaceConflict === 'renamed_on_workspace') {
    return { conflict: true, applicable: false, skipReason: 'renamed_on_workspace' }
  }
  if (workspaceConflict === 'modified') {
    return { conflict: true, applicable: false, skipReason: 'workspace_modified_since_base' }
  }
  return { conflict: false, applicable: true }
}

export class ChatSessionApplyService {
  constructor(private readonly deps: ChatSessionApplyServiceDeps) {}

  private async readIsolatedPorcelainEntries(isolatedRepoPath: string) {
    const status = await execa('git', ['status', '--porcelain=v1', '-z', '-u'], {
      cwd: isolatedRepoPath,
      reject: false,
    })
    if (status.exitCode !== 0) {
      throw new Error(status.stderr.trim() || 'Failed to read isolated repo status')
    }
    return parsePorcelainEntries(status.stdout)
  }

  private async buildPendingFile(
    workspacePath: string,
    baseRef: string,
    isolatedRepoPath: string,
    entry: { path: string; oldPath?: string; status: DiffFileStatus },
  ): Promise<ChatSessionPendingFile> {
    const relPath = ensureRelativePath(entry.path)
    const relOldPath = entry.oldPath ? ensureRelativePath(entry.oldPath) : undefined
    const stat = await readNumstatIsolated(isolatedRepoPath, relPath, relOldPath)
    const workspaceConflict = await workspaceConflictSinceBase(workspacePath, baseRef, relPath)
    const isBinary = stat.binary || (await isBinaryFileAtPath(join(isolatedRepoPath, relPath)))
    const flags = classifyFile({
      entry: { ...entry, path: relPath, oldPath: relOldPath },
      workspaceConflict,
      isBinary,
    })
    const statusValue = isBinary ? 'binary' : entry.status
    return {
      path: relPath,
      oldPath: relOldPath,
      status: statusValue,
      additions: stat.additions,
      deletions: stat.deletions,
      ...flags,
    }
  }

  private async findPendingFile(
    ctx: ResolvedApplyContext,
    relPath: string,
  ): Promise<ChatSessionPendingFile | null> {
    const entries = await this.readIsolatedPorcelainEntries(ctx.meta.isolatedRepoPath)
    const entry = entries.find((row) => ensureRelativePath(row.path) === relPath)
    if (!entry) return null
    return this.buildPendingFile(
      ctx.meta.workspacePath,
      ctx.meta.baseRef,
      ctx.meta.isolatedRepoPath,
      entry,
    )
  }

  async resolveContext(
    threadId: string,
    expectedSessionId?: string,
  ): Promise<ResolvedApplyContext> {
    const workspacePath = this.deps.requireWorkspacePath()
    const paths = this.deps.requireSidecarPaths()
    const loaded = await this.deps.ledgerStore.getWithTurns(paths, workspacePath, threadId)
    if (!loaded) {
      throw new ChatSessionApplyNotFoundError(`Conversation thread not found: ${threadId}`)
    }
    const activeSessionId = loaded.thread.activeSessionId?.trim()
    if (!activeSessionId) {
      throw new ChatSessionApplyNotFoundError(`No active composer session for thread: ${threadId}`)
    }
    if (expectedSessionId && expectedSessionId !== activeSessionId) {
      throw new ChatSessionApplyMismatchError(`Active session changed for thread ${threadId}`)
    }
    if (loaded.thread.sessionPolicy !== 'planetz-chat-agent') {
      throw new ChatSessionApplyPolicyError('Workspace Apply requires agent conversation mode')
    }
    const meta = getChatApplySessionMeta(activeSessionId)
    if (!meta) {
      throw new ChatSessionApplyNotFoundError(
        `No apply metadata for composer session: ${activeSessionId}`,
      )
    }
    if (meta.threadId !== threadId) {
      throw new ChatSessionApplyMismatchError('Apply metadata thread mismatch')
    }
    if (meta.workspacePath !== workspacePath) {
      throw new ChatSessionApplyPolicyError('Apply metadata workspace mismatch')
    }
    return {
      meta,
      threadId,
      composerSessionId: activeSessionId,
    }
  }

  async getPendingChanges(
    threadId: string,
    expectedSessionId?: string,
  ): Promise<ChatSessionPendingChangesResult> {
    const ctx = await this.resolveContext(threadId, expectedSessionId)
    const isolatedRepoPath = this.deps.requireIsolatedRepoPath()
    if (ctx.meta.isolatedRepoPath !== isolatedRepoPath) {
      throw new ChatSessionApplyPolicyError('Isolated repo path mismatch')
    }
    const workspacePath = ctx.meta.workspacePath
    const entries = await this.readIsolatedPorcelainEntries(isolatedRepoPath)
    const truncated = entries.length > TASK_RESULT_DIFF_MAX_FILES
    const limited = entries.slice(0, TASK_RESULT_DIFF_MAX_FILES)
    const files: ChatSessionPendingFile[] = []
    for (const entry of limited) {
      files.push(
        await this.buildPendingFile(workspacePath, ctx.meta.baseRef, isolatedRepoPath, entry),
      )
    }
    return {
      threadId: ctx.threadId,
      composerSessionId: ctx.composerSessionId,
      baseRef: ctx.meta.baseRef,
      files,
      truncated: truncated || undefined,
    }
  }

  async getPendingChangeFile(
    threadId: string,
    path: string,
    expectedSessionId?: string,
  ): Promise<ChatSessionPendingChangeFileResult> {
    const ctx = await this.resolveContext(threadId, expectedSessionId)
    const relPath = ensureRelativePath(path)
    const isolatedRepoPath = ctx.meta.isolatedRepoPath
    const diff = await execa('git', ['diff', 'HEAD', '--', relPath], {
      cwd: isolatedRepoPath,
      reject: false,
    })
    const raw = diff.stdout
    if (!raw.trim()) {
      const filePath = join(isolatedRepoPath, relPath)
      try {
        const body = await readFile(filePath)
        if (body.byteLength > TASK_RESULT_DIFF_MAX_FILE_BYTES) {
          return {
            path: relPath,
            status: 'added',
            lines: [{ kind: 'meta', text: 'File too large to preview.' }],
            additions: 0,
            deletions: 0,
            truncated: true,
          }
        }
        const text = body.toString('utf8')
        const lineCount = text.split('\n').length
        return {
          path: relPath,
          status: 'added',
          lines: text.split('\n').map((line) => ({ kind: 'add' as const, text: line })),
          additions: lineCount,
          deletions: 0,
        }
      } catch {
        throw new ChatSessionApplyNotFoundError(`Pending change file not found: ${relPath}`)
      }
    }
    const parsed = parseGitUnifiedDiff(raw, TASK_RESULT_DIFF_MAX_FILE_BYTES)
    const row = await this.findPendingFile(ctx, relPath)
    return {
      path: relPath,
      oldPath: row?.oldPath,
      status: row?.status ?? 'modified',
      lines: parsed.lines,
      additions: row?.additions ?? 0,
      deletions: row?.deletions ?? 0,
      truncated: parsed.truncated || undefined,
      binary: row?.status === 'binary' || undefined,
    }
  }

  async applyChanges(input: ChatSessionApplyChangesInput): Promise<ChatSessionApplyChangesResult> {
    const ctx = await this.resolveContext(input.threadId, input.expectedSessionId)
    const strategy = input.strategy ?? 'skip_conflicts'
    const pending = await this.getPendingChanges(input.threadId, input.expectedSessionId)
    const requested = new Set(
      (input.paths.length > 0
        ? input.paths
        : pending.files.filter((f) => f.applicable).map((f) => f.path)
      ).map((p) => ensureRelativePath(p)),
    )
    const applied: string[] = []
    const skipped: Array<{ path: string; reason: ChatApplySkipReason }> = []

    const hasBlocking = [...requested].some((path) => {
      const row = pending.files.find((file) => file.path === path)
      return row && !row.applicable
    })
    if (strategy === 'all_or_nothing' && hasBlocking) {
      for (const path of requested) {
        const row = pending.files.find((file) => file.path === path)
        skipped.push({
          path,
          reason: row?.skipReason ?? 'not_applicable_status',
        })
      }
      return { applied, skipped }
    }

    for (const path of requested) {
      const row = pending.files.find((file) => file.path === path)
      if (!row) {
        skipped.push({ path, reason: 'not_applicable_status' })
        continue
      }
      if (!row.applicable) {
        skipped.push({ path, reason: row.skipReason ?? 'not_applicable_status' })
        continue
      }
      const src = join(ctx.meta.isolatedRepoPath, path)
      const dest = join(ctx.meta.workspacePath, path)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, await readFile(src))
      const sourceMode = (await stat(src)).mode & 0o777
      await chmod(dest, sourceMode)
      applied.push(path)
    }

    let artifactId: string | undefined
    if (applied.length > 0) {
      const payload: ChatApplyEventPayload = chatApplyEventPayloadSchema.parse({
        kind: 'applied',
        appliedAt: new Date().toISOString(),
        appliedPaths: applied,
        baseRef: ctx.meta.baseRef,
        composerSessionId: ctx.composerSessionId,
      })
      artifactId = `art_apply_${ctx.threadId}_${ctx.composerSessionId}`
      const db = await getSidecarSqlite(this.deps.requireSidecarPaths())
      upsertConversationArtifact(db, {
        artifactId,
        threadId: ctx.threadId,
        artifactRef: ctx.composerSessionId,
        kind: 'summary',
        priority: 'high',
        payloadJson: JSON.stringify(payload),
      })
    }

    return { applied, skipped, artifactId }
  }
}
