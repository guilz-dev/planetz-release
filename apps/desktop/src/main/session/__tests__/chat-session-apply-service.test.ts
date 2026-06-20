import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../storage/sqlite/repositories/conversation-artifact-repository.js', () => ({
  upsertConversationArtifact: vi.fn(),
}))

import { execa } from 'execa'
import type { ConversationLedgerStore } from '../../sidecar/conversation-ledger-store.js'
import {
  clearChatApplySessionRegistryForTests,
  registerChatApplySessionMeta,
} from '../chat-apply-session-registry.js'
import {
  ChatSessionApplyMismatchError,
  ChatSessionApplyPolicyError,
} from '../chat-session-apply-errors.js'
import { ChatSessionApplyService } from '../chat-session-apply-service.js'

async function initGitRepo(dir: string, files: Record<string, string>): Promise<string> {
  await mkdir(dir, { recursive: true })
  await execa('git', ['init'], { cwd: dir })
  await execa('git', ['config', 'user.email', 'test@planetz.local'], { cwd: dir })
  await execa('git', ['config', 'user.name', 'Planetz Test'], { cwd: dir })
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel)
    await mkdir(join(full, '..'), { recursive: true })
    await writeFile(full, body, 'utf8')
  }
  if (Object.keys(files).length > 0) {
    await execa('git', ['add', '.'], { cwd: dir })
    await execa('git', ['commit', '-m', 'init'], { cwd: dir })
  }
  const head = await execa('git', ['rev-parse', 'HEAD'], { cwd: dir })
  return head.stdout.trim()
}

describe('ChatSessionApplyService', () => {
  let workspacePath = ''
  let isolatedPath = ''
  let baseRef = ''
  const threadId = 'thread-1'
  const composerSessionId = 'composer-1'

  const ledgerStore = {
    getWithTurns: async () => ({
      thread: {
        threadId,
        activeSessionId: composerSessionId,
        sessionPolicy: 'planetz-chat-agent' as const,
      },
      turns: [],
    }),
  } as unknown as ConversationLedgerStore

  beforeEach(async () => {
    clearChatApplySessionRegistryForTests()
    const root = join(tmpdir(), `chat-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    workspacePath = join(root, 'main')
    isolatedPath = join(root, 'isolated')
    baseRef = await initGitRepo(workspacePath, { 'shared.txt': 'base\n' })
    await initGitRepo(isolatedPath, { 'shared.txt': 'base\n' })
    registerChatApplySessionMeta({
      composerSessionId,
      threadId,
      baseRef,
      isolatedRepoPath: isolatedPath,
      workspacePath,
      capturedAt: new Date().toISOString(),
    })
  })

  afterEach(() => {
    clearChatApplySessionRegistryForTests()
  })

  function createService(ledger: ConversationLedgerStore = ledgerStore) {
    return new ChatSessionApplyService({
      requireWorkspacePath: () => workspacePath,
      requireIsolatedRepoPath: () => isolatedPath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
      ledgerStore: ledger,
    })
  }

  it('rejects apply when session id mismatches', async () => {
    const service = createService()
    await expect(service.getPendingChanges(threadId, 'other-session')).rejects.toBeInstanceOf(
      ChatSessionApplyMismatchError,
    )
  })

  it('marks workspace-modified files as conflicts', async () => {
    await writeFile(join(workspacePath, 'shared.txt'), 'main changed\n', 'utf8')
    await execa('git', ['add', 'shared.txt'], { cwd: workspacePath })
    await execa('git', ['commit', '-m', 'main change'], { cwd: workspacePath })

    await writeFile(join(isolatedPath, 'shared.txt'), 'isolated changed\n', 'utf8')

    const service = createService()
    const pending = await service.getPendingChanges(threadId)
    const row = pending.files.find((file) => file.path === 'shared.txt')
    expect(row?.conflict).toBe(true)
    expect(row?.applicable).toBe(false)
    expect(row?.skipReason).toBe('workspace_modified_since_base')
  })

  it('copies applicable files to main workspace on apply', async () => {
    await mkdir(join(isolatedPath, 'src'), { recursive: true })
    await writeFile(join(isolatedPath, 'src/new.ts'), 'export const x = 1\n', 'utf8')

    const service = createService()
    const result = await service.applyChanges({
      threadId,
      paths: ['src/new.ts'],
    })
    expect(result.applied).toEqual(['src/new.ts'])
    const mainBody = await readFile(join(workspacePath, 'src', 'new.ts'), 'utf8')
    expect(mainBody).toBe('export const x = 1\n')
  })

  it('preserves executable mode when applying files', async () => {
    await mkdir(join(isolatedPath, 'scripts'), { recursive: true })
    const scriptPath = join(isolatedPath, 'scripts', 'run.sh')
    await writeFile(scriptPath, '#!/usr/bin/env bash\necho ok\n', 'utf8')
    await chmod(scriptPath, 0o755)

    const service = createService()
    const result = await service.applyChanges({
      threadId,
      paths: ['scripts/run.sh'],
    })

    expect(result.applied).toEqual(['scripts/run.sh'])
    const mainMode = (await stat(join(workspacePath, 'scripts', 'run.sh'))).mode & 0o777
    expect(mainMode).toBe(0o755)
  })

  it('parses rename status with whitespace paths', async () => {
    await writeFile(join(isolatedPath, 'old name.ts'), 'export const renamed = 1\n', 'utf8')
    await execa('git', ['add', 'old name.ts'], { cwd: isolatedPath })
    await execa('git', ['commit', '-m', 'add rename source'], { cwd: isolatedPath })
    await execa('git', ['mv', 'old name.ts', 'new name.ts'], { cwd: isolatedPath })

    const service = createService()
    const pending = await service.getPendingChanges(threadId)
    const row = pending.files.find((file) => file.path === 'new name.ts')

    expect(row).toMatchObject({
      oldPath: 'old name.ts',
      status: 'renamed',
      applicable: false,
      skipReason: 'rename_requires_manual_apply',
    })
  })

  it('marks workspace-deleted paths as deleted_on_workspace', async () => {
    await execa('git', ['rm', 'shared.txt'], { cwd: workspacePath })
    await writeFile(join(isolatedPath, 'shared.txt'), 'isolated only\n', 'utf8')

    const service = createService()
    const pending = await service.getPendingChanges(threadId)
    const row = pending.files.find((file) => file.path === 'shared.txt')
    expect(row?.skipReason).toBe('deleted_on_workspace')
    expect(row?.applicable).toBe(false)
  })

  it('marks binary files as not applicable', async () => {
    await mkdir(join(isolatedPath, 'assets'), { recursive: true })
    await writeFile(join(isolatedPath, 'assets', 'icon.bin'), Buffer.from([0, 1, 2, 3]))

    const service = createService()
    const pending = await service.getPendingChanges(threadId)
    const row = pending.files.find((file) => file.path === 'assets/icon.bin')
    expect(row?.skipReason).toBe('binary_not_supported')
    expect(row?.applicable).toBe(false)
  })

  it('rejects non-agent session policy', async () => {
    const investigateLedger = {
      getWithTurns: async () => ({
        thread: {
          threadId,
          activeSessionId: composerSessionId,
          sessionPolicy: 'planetz-chat-investigate' as const,
        },
        turns: [],
      }),
    } as unknown as ConversationLedgerStore
    const service = createService(investigateLedger)
    await expect(service.getPendingChanges(threadId)).rejects.toBeInstanceOf(
      ChatSessionApplyPolicyError,
    )
  })
})
