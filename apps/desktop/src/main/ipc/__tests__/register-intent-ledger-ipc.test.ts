import { IPC_CHANNELS } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, broadcastNowMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  broadcastNowMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: vi.fn(),
  },
}))

import type { AppSession } from '../../app-session.js'
import type { IpcContext } from '../ipc-context.js'
import { registerIntentLedgerIpc } from '../register-intent-ledger-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerIntentLedgerIpc', () => {
  const listPendingIntentLedger = vi.fn()
  const countPendingIntentLedger = vi.fn()
  const getIntentLedgerSummary = vi.fn()
  const listIntentLedgerByThread = vi.fn()
  const listSupplyIntentLedger = vi.fn()
  const ratifyIntentLedgerEntry = vi.fn()
  const reverseIntentLedgerEntry = vi.fn()
  const adoptIntentLedgerEntry = vi.fn()
  const fixIntentLedgerEntry = vi.fn()

  const ctx = {
    session: {
      listPendingIntentLedger,
      countPendingIntentLedger,
      getIntentLedgerSummary,
      listIntentLedgerByThread,
      listSupplyIntentLedger,
      ratifyIntentLedgerEntry,
      reverseIntentLedgerEntry,
      adoptIntentLedgerEntry,
      fixIntentLedgerEntry,
    } as Pick<
      AppSession,
      | 'listPendingIntentLedger'
      | 'countPendingIntentLedger'
      | 'getIntentLedgerSummary'
      | 'listIntentLedgerByThread'
      | 'listSupplyIntentLedger'
      | 'ratifyIntentLedgerEntry'
      | 'reverseIntentLedgerEntry'
      | 'adoptIntentLedgerEntry'
      | 'fixIntentLedgerEntry'
    >,
    broadcast: {
      broadcastNow: broadcastNowMock,
    },
  } as unknown as IpcContext

  beforeEach(() => {
    handleMock.mockClear()
    broadcastNowMock.mockClear()
    listPendingIntentLedger.mockReset()
    countPendingIntentLedger.mockReset()
    getIntentLedgerSummary.mockReset()
    listIntentLedgerByThread.mockReset()
    listSupplyIntentLedger.mockReset()
    ratifyIntentLedgerEntry.mockReset()
    reverseIntentLedgerEntry.mockReset()
    adoptIntentLedgerEntry.mockReset()
    fixIntentLedgerEntry.mockReset()
    registerIntentLedgerIpc(ctx)
  })

  it('routes intentLedger:listPending to session.listPendingIntentLedger', async () => {
    listPendingIntentLedger.mockResolvedValue({ entries: [] })
    const handler = getHandler(IPC_CHANNELS.intentLedgerListPending)
    await handler(null, { expensiveOnly: true })
    expect(listPendingIntentLedger).toHaveBeenCalledWith({ expensiveOnly: true })
    expect(broadcastNowMock).not.toHaveBeenCalled()
  })

  it('routes intentLedger:getSummary to session.getIntentLedgerSummary', async () => {
    getIntentLedgerSummary.mockResolvedValue({
      window: '7d',
      ingestedAssumedCount: 2,
      pendingCount: 1,
      ratifiedCount: 1,
      reversedCount: 0,
      adjudicationRate: 0.5,
      scopeConflictCount: 0,
      unanchoredCount: 0,
      unanchoredRate: null,
      adjudicationLatencyP50Ms: null,
      ratifyRatio: null,
      reverseRatio: null,
      adoptCount: 0,
      fixCount: 0,
    })
    const handler = getHandler(IPC_CHANNELS.intentLedgerGetSummary)
    await handler(null, { window: '7d', expensiveOnly: true })
    expect(getIntentLedgerSummary).toHaveBeenCalledWith({
      window: '7d',
      expensiveOnly: true,
    })
  })

  it('routes intentLedger:listByThread to session.listIntentLedgerByThread', async () => {
    listIntentLedgerByThread.mockResolvedValue({ entries: [], taskIds: [] })
    const handler = getHandler(IPC_CHANNELS.intentLedgerListByThread)
    await handler(null, { threadId: 'thread-1' })
    expect(listIntentLedgerByThread).toHaveBeenCalledWith({ threadId: 'thread-1' })
    expect(broadcastNowMock).not.toHaveBeenCalled()
  })

  it('routes intentLedger:listSupply to session.listSupplyIntentLedger', async () => {
    listSupplyIntentLedger.mockResolvedValue({ entries: [] })
    const handler = getHandler(IPC_CHANNELS.intentLedgerListSupply)
    await handler(null, undefined)
    expect(listSupplyIntentLedger).toHaveBeenCalled()
    expect(broadcastNowMock).not.toHaveBeenCalled()
  })

  it('routes intentLedger:ratify to session.ratifyIntentLedgerEntry', async () => {
    ratifyIntentLedgerEntry.mockResolvedValue({ ok: true })
    const handler = getHandler(IPC_CHANNELS.intentLedgerRatify)
    await handler(null, { entryId: 'task-1:run-a:d1' })
    expect(ratifyIntentLedgerEntry).toHaveBeenCalledWith('task-1:run-a:d1')
    expect(broadcastNowMock).toHaveBeenCalledTimes(1)
  })

  it('routes intentLedger:adopt to session.adoptIntentLedgerEntry', async () => {
    adoptIntentLedgerEntry.mockResolvedValue({ ok: true, promotedReqId: 'REQ-auth-2' })
    const handler = getHandler(IPC_CHANNELS.intentLedgerAdopt)
    await handler(null, { entryId: 'task-1:run-a:d1', reason: 'operator adopt' })
    expect(adoptIntentLedgerEntry).toHaveBeenCalledWith({
      entryId: 'task-1:run-a:d1',
      reason: 'operator adopt',
    })
    expect(broadcastNowMock).toHaveBeenCalledTimes(1)
  })

  it('routes intentLedger:fix to session.fixIntentLedgerEntry', async () => {
    fixIntentLedgerEntry.mockResolvedValue({ ok: true })
    const handler = getHandler(IPC_CHANNELS.intentLedgerFix)
    await handler(null, { entryId: 'task-1:run-a:d1' })
    expect(fixIntentLedgerEntry).toHaveBeenCalledWith({ entryId: 'task-1:run-a:d1' })
    expect(broadcastNowMock).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid intentLedger:getSummary input', async () => {
    const handler = getHandler(IPC_CHANNELS.intentLedgerGetSummary)
    await expect(handler(null, { window: 'invalid' })).rejects.toThrow(/intentLedger:getSummary/)
  })

  it('rejects invalid intentLedger:ratify input', async () => {
    const handler = getHandler(IPC_CHANNELS.intentLedgerRatify)
    await expect(handler(null, { entryId: '' })).rejects.toThrow(/intentLedger:ratify/)
  })

  it('rejects invalid intentLedger:adopt input', async () => {
    const handler = getHandler(IPC_CHANNELS.intentLedgerAdopt)
    await expect(handler(null, { entryId: '' })).rejects.toThrow(/intentLedger:adopt/)
  })
})
