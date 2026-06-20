import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { IPC_CHANNELS } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: vi.fn(),
  },
}))

import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import type { AppSession } from '../../app-session.js'
import { ConversationHistoryService } from '../../session/conversation-history-service.js'
import { ConversationLedgerStore } from '../../sidecar/conversation-ledger-store.js'
import { closeAllSidecarSqlite } from '../../storage/sqlite/connection.js'
import type { IpcContext } from '../ipc-context.js'
import { registerConversationHistoryIpc } from '../register-conversation-history-ipc.js'

const WORKSPACE = '/tmp/planetz-conv-ipc-ws'
const OTHER_WORKSPACE = '/tmp/planetz-conv-ipc-other-ws'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerConversationHistoryIpc', () => {
  const roots: string[] = []
  let ctx: IpcContext
  let paths: ReturnType<typeof mockSidecarPaths>
  let ledgerStore: ConversationLedgerStore

  beforeEach(async () => {
    handleMock.mockClear()
    const root = await mkdtemp(join(tmpdir(), 'conv-history-ipc-'))
    roots.push(root)
    paths = mockSidecarPaths(root)
    ledgerStore = new ConversationLedgerStore()
    const historyService = new ConversationHistoryService({
      requireWorkspacePath: () => WORKSPACE,
      requireSidecarPaths: () => paths,
      ledgerStore,
    })
    const session = {
      listConversationHistory: (input?: Parameters<ConversationHistoryService['list']>[0]) =>
        historyService.list(input),
      getConversationHistory: (input: Parameters<ConversationHistoryService['get']>[0]) =>
        historyService.get(input),
      deleteConversationHistory: (input: Parameters<ConversationHistoryService['delete']>[0]) =>
        historyService.delete(input),
      searchConversationHistory: (input: Parameters<ConversationHistoryService['search']>[0]) =>
        historyService.search(input),
    } as unknown as AppSession
    ctx = { session } as IpcContext
    registerConversationHistoryIpc(ctx)

    await ledgerStore.insertThread(paths, {
      threadId: 'thr_ipc',
      workspacePath: WORKSPACE,
      title: 'IPC thread',
      updatedAt: '2026-06-01T12:00:00.000Z',
    })
    await ledgerStore.insertTurn(paths, {
      turnId: 'turn_ipc',
      threadId: 'thr_ipc',
      turnIndex: 0,
      role: 'user',
      content: 'hello ipc',
      createdAt: '2026-06-01T12:00:00.000Z',
    })
  })

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('lists open threads for current workspace', async () => {
    const listHandler = getHandler(IPC_CHANNELS.conversationHistoryList)
    const result = await listHandler(null, {})
    expect(result).toEqual({
      threads: [
        expect.objectContaining({
          threadId: 'thr_ipc',
          title: 'IPC thread',
          workspacePath: WORKSPACE,
          hasActiveSession: false,
        }),
      ],
    })
  })

  it('gets thread with turns', async () => {
    const getHandlerFn = getHandler(IPC_CHANNELS.conversationHistoryGet)
    const result = await getHandlerFn(null, { threadId: 'thr_ipc' })
    expect(result).toMatchObject({
      found: true,
      thread: { threadId: 'thr_ipc', title: 'IPC thread' },
      turns: [{ turnId: 'turn_ipc', role: 'user', content: 'hello ipc' }],
    })
  })

  it('returns sessionPolicy on list and get when stored on the thread', async () => {
    await ledgerStore.insertThread(paths, {
      threadId: 'thr_spec_policy',
      workspacePath: WORKSPACE,
      title: 'Spec chat',
      updatedAt: '2026-06-02T12:00:00.000Z',
      sessionPolicy: 'planetz-chat-spec',
    })

    const listHandler = getHandler(IPC_CHANNELS.conversationHistoryList)
    const listed = await listHandler(null, {})
    expect(listed).toEqual({
      threads: expect.arrayContaining([
        expect.objectContaining({
          threadId: 'thr_spec_policy',
          sessionPolicy: 'planetz-chat-spec',
        }),
      ]),
    })

    const getHandlerFn = getHandler(IPC_CHANNELS.conversationHistoryGet)
    const got = await getHandlerFn(null, { threadId: 'thr_spec_policy' })
    expect(got).toMatchObject({
      found: true,
      thread: {
        threadId: 'thr_spec_policy',
        sessionPolicy: 'planetz-chat-spec',
      },
    })
  })

  it('searches threads case-insensitively', async () => {
    const searchHandler = getHandler(IPC_CHANNELS.conversationHistorySearch)
    const result = await searchHandler(null, { query: 'IPC' })
    expect(result).toEqual({
      threads: [expect.objectContaining({ threadId: 'thr_ipc' })],
    })
  })

  it('deletes thread and subsequent get returns found=false', async () => {
    const deleteHandler = getHandler(IPC_CHANNELS.conversationHistoryDelete)
    await expect(deleteHandler(null, { threadId: 'thr_ipc' })).resolves.toEqual({
      ok: true,
      deleted: true,
    })

    const getHandlerFn = getHandler(IPC_CHANNELS.conversationHistoryGet)
    await expect(getHandlerFn(null, { threadId: 'thr_ipc' })).resolves.toEqual({ found: false })
  })

  it('returns deleted=false when thread id does not exist', async () => {
    const deleteHandler = getHandler(IPC_CHANNELS.conversationHistoryDelete)
    await expect(deleteHandler(null, { threadId: 'thr_missing' })).resolves.toEqual({
      ok: true,
      deleted: false,
    })
  })

  it('ignores workspacePath on list input and scopes to the open workspace', async () => {
    await ledgerStore.insertThread(paths, {
      threadId: 'thr_other',
      workspacePath: OTHER_WORKSPACE,
      title: 'Other workspace thread',
      updatedAt: '2026-06-01T13:00:00.000Z',
    })

    const listHandler = getHandler(IPC_CHANNELS.conversationHistoryList)
    const result = await listHandler(null, { workspacePath: OTHER_WORKSPACE })
    expect(result).toEqual({
      threads: [expect.objectContaining({ threadId: 'thr_ipc' })],
    })
  })

  it('validates input payloads', async () => {
    const searchHandler = getHandler(IPC_CHANNELS.conversationHistorySearch)
    await expect(searchHandler(null, { query: '   ' })).rejects.toThrow(
      /conversationHistory:search/,
    )
    const getHandlerFn = getHandler(IPC_CHANNELS.conversationHistoryGet)
    await expect(getHandlerFn(null, { threadId: '' })).rejects.toThrow(/conversationHistory:get/)
  })
})
