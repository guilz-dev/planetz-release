import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import { ConversationLedgerStore } from '../../sidecar/conversation-ledger-store.js'
import { closeAllSidecarSqlite } from '../../storage/sqlite/connection.js'
import { ConversationHistoryService } from '../conversation-history-service.js'

const WORKSPACE = '/tmp/planetz-conv-history-svc-ws'
const OTHER_WORKSPACE = '/tmp/planetz-conv-history-svc-other-ws'

describe('ConversationHistoryService', () => {
  const roots: string[] = []
  let paths: ReturnType<typeof mockSidecarPaths>
  let service: ConversationHistoryService

  beforeEach(async () => {
    const root = await mkdtemp(join(tmpdir(), 'conv-history-svc-'))
    roots.push(root)
    paths = mockSidecarPaths(root)
    const ledgerStore = new ConversationLedgerStore()
    service = new ConversationHistoryService({
      requireWorkspacePath: () => WORKSPACE,
      requireSidecarPaths: () => paths,
      ledgerStore,
    })
    await ledgerStore.insertThread(paths, {
      threadId: 'thr_svc',
      workspacePath: WORKSPACE,
      title: 'Service thread',
      updatedAt: '2026-06-01T14:00:00.000Z',
    })
    await ledgerStore.insertTurn(paths, {
      turnId: 'turn_svc',
      threadId: 'thr_svc',
      turnIndex: 0,
      role: 'user',
      content: 'hello service',
      createdAt: '2026-06-01T14:00:00.000Z',
    })
  })

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('lists threads for the open workspace only', async () => {
    const ledgerStore = new ConversationLedgerStore()
    await ledgerStore.insertThread(paths, {
      threadId: 'thr_other',
      workspacePath: OTHER_WORKSPACE,
      title: 'Other',
      updatedAt: '2026-06-01T14:00:00.000Z',
    })

    const result = await service.list({ workspacePath: OTHER_WORKSPACE })
    expect(result.threads.map((t) => t.threadId)).toEqual(['thr_svc'])
  })

  it('gets thread with turns', async () => {
    const result = await service.get({ threadId: 'thr_svc' })
    expect(result).toMatchObject({
      found: true,
      thread: { threadId: 'thr_svc' },
      turns: [{ turnId: 'turn_svc', content: 'hello service' }],
    })
  })

  it('returns deleted=false for unknown thread id', async () => {
    const result = await service.delete({ threadId: 'thr_missing' })
    expect(result).toEqual({ ok: true, deleted: false })
  })
})
