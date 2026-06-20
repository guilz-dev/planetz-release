import { IPC_CHANNELS } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: vi.fn(),
  },
}))

import type { AppSession } from '../../app-session.js'
import type { IpcContext } from '../ipc-context.js'
import { registerExecutionIpc } from '../register-execution-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerExecutionIpc', () => {
  const listExecutionLog = vi.fn()
  const getExecutionSummary = vi.fn()

  const ctx = {
    session: {
      listExecutionLog,
      getExecutionSummary,
    } as Pick<AppSession, 'listExecutionLog' | 'getExecutionSummary'>,
  } as IpcContext

  beforeEach(() => {
    handleMock.mockClear()
    listExecutionLog.mockReset()
    getExecutionSummary.mockReset()
    registerExecutionIpc(ctx)
  })

  it('routes executionLog:list to session.listExecutionLog', async () => {
    listExecutionLog.mockResolvedValue({ records: [], total: 0, truncated: false })
    const handler = getHandler(IPC_CHANNELS.executionLogList)
    await handler(null, {})
    expect(listExecutionLog).toHaveBeenCalledWith({})
  })

  it('routes executionSummary:get to session.getExecutionSummary', async () => {
    getExecutionSummary.mockResolvedValue({
      window: '7d',
      total: 0,
      completed: 0,
      failureCount: 0,
      successRate: 0,
      byStatus: [],
      byExecutor: [],
      byWorkflow: [],
    })
    const handler = getHandler(IPC_CHANNELS.executionSummaryGet)
    await handler(null, { window: '7d' })
    expect(getExecutionSummary).toHaveBeenCalledWith({ window: '7d' })
  })

  it('rejects invalid executionSummary:get window', async () => {
    const handler = getHandler(IPC_CHANNELS.executionSummaryGet)
    await expect(handler(null, { window: 'invalid' })).rejects.toThrow(/executionSummary:get/)
  })

  it('passes runId and cursor to session.listExecutionLog', async () => {
    listExecutionLog.mockResolvedValue({
      records: [],
      total: 0,
      truncated: false,
      rawTotalInWindow: 0,
      hasMore: false,
    })
    const handler = getHandler(IPC_CHANNELS.executionLogList)
    await handler(null, { runId: 'run-a:session-1', cursor: 'abc' })
    expect(listExecutionLog).toHaveBeenCalledWith({
      runId: 'run-a:session-1',
      cursor: 'abc',
    })
  })

  it('rejects invalid executionLog:list cursor', async () => {
    const handler = getHandler(IPC_CHANNELS.executionLogList)
    await expect(handler(null, { cursor: '' })).rejects.toThrow(/executionLog:list/)
  })
})
