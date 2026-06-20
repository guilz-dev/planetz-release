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
import { registerSpecStudioIpc } from '../register-spec-studio-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerSpecStudioIpc', () => {
  const listSpecThreadSummaries = vi.fn()
  const getCurrentDecidedIntent = vi.fn()
  const listDecidedIntentVersions = vi.fn()
  const saveDecidedIntent = vi.fn()
  const getIntentDraft = vi.fn()
  const saveIntentDraft = vi.fn()
  const generateIntentDraft = vi.fn()
  const clearIntentDraft = vi.fn()

  const ctx = {
    session: {
      listSpecThreadSummaries,
      getCurrentDecidedIntent,
      listDecidedIntentVersions,
      saveDecidedIntent,
      getIntentDraft,
      saveIntentDraft,
      generateIntentDraft,
      clearIntentDraft,
    } as Pick<
      AppSession,
      | 'listSpecThreadSummaries'
      | 'getCurrentDecidedIntent'
      | 'listDecidedIntentVersions'
      | 'saveDecidedIntent'
      | 'getIntentDraft'
      | 'saveIntentDraft'
      | 'generateIntentDraft'
      | 'clearIntentDraft'
    >,
    broadcast: {
      broadcastNow: broadcastNowMock,
    },
  } as unknown as IpcContext

  beforeEach(() => {
    handleMock.mockClear()
    broadcastNowMock.mockClear()
    listSpecThreadSummaries.mockReset()
    getCurrentDecidedIntent.mockReset()
    listDecidedIntentVersions.mockReset()
    saveDecidedIntent.mockReset()
    getIntentDraft.mockReset()
    saveIntentDraft.mockReset()
    generateIntentDraft.mockReset()
    clearIntentDraft.mockReset()
    registerSpecStudioIpc(ctx)
  })

  it('routes specThread:summaryList to session.listSpecThreadSummaries', async () => {
    listSpecThreadSummaries.mockResolvedValue({ summaries: [] })
    const handler = getHandler(IPC_CHANNELS.specThreadSummaryList)
    await handler(null, { limit: 5 })
    expect(listSpecThreadSummaries).toHaveBeenCalledWith({ limit: 5 })
    expect(broadcastNowMock).not.toHaveBeenCalled()
  })

  it('passes undefined to listSpecThreadSummaries when no input is given', async () => {
    listSpecThreadSummaries.mockResolvedValue({ summaries: [] })
    const handler = getHandler(IPC_CHANNELS.specThreadSummaryList)
    await handler(null, undefined)
    expect(listSpecThreadSummaries).toHaveBeenCalledWith(undefined)
  })

  it('routes decidedIntent:getCurrent to session.getCurrentDecidedIntent', async () => {
    getCurrentDecidedIntent.mockResolvedValue({ intent: null })
    const handler = getHandler(IPC_CHANNELS.decidedIntentGetCurrent)
    await handler(null, { threadId: 'thread-1' })
    expect(getCurrentDecidedIntent).toHaveBeenCalledWith({ threadId: 'thread-1' })
    expect(broadcastNowMock).not.toHaveBeenCalled()
  })

  it('routes decidedIntent:listVersions to session.listDecidedIntentVersions', async () => {
    listDecidedIntentVersions.mockResolvedValue({ versions: [] })
    const handler = getHandler(IPC_CHANNELS.decidedIntentListVersions)
    await handler(null, { threadId: 'thread-1' })
    expect(listDecidedIntentVersions).toHaveBeenCalledWith({ threadId: 'thread-1' })
  })

  it('routes decidedIntent:save to session.saveDecidedIntent', async () => {
    saveDecidedIntent.mockResolvedValue({ intent: null })
    const handler = getHandler(IPC_CHANNELS.decidedIntentSave)
    await handler(null, { threadId: 'thread-1', what: 'do x', why: 'because' })
    expect(saveDecidedIntent).toHaveBeenCalledWith({
      threadId: 'thread-1',
      what: 'do x',
      why: 'because',
    })
  })

  it('rejects invalid decidedIntent:save input', async () => {
    const handler = getHandler(IPC_CHANNELS.decidedIntentSave)
    await expect(handler(null, { threadId: 'thread-1', what: '', why: '' })).rejects.toThrow(
      /decidedIntent:save/,
    )
  })

  it('rejects invalid decidedIntent:getCurrent input', async () => {
    const handler = getHandler(IPC_CHANNELS.decidedIntentGetCurrent)
    await expect(handler(null, { threadId: '' })).rejects.toThrow(/decidedIntent:getCurrent/)
  })

  it('routes intentDraft:get to session.getIntentDraft', async () => {
    getIntentDraft.mockResolvedValue({ draft: null })
    const handler = getHandler(IPC_CHANNELS.intentDraftGet)
    await handler(null, { threadId: 'thread-1' })
    expect(getIntentDraft).toHaveBeenCalledWith({ threadId: 'thread-1' })
  })

  it('routes intentDraft:save to session.saveIntentDraft', async () => {
    saveIntentDraft.mockResolvedValue({
      draft: {
        threadId: 'thread-1',
        autoGenerate: true,
        what: '',
        why: '',
        outOfScopeText: '',
        touchedByUser: false,
        basedOnIntentVersion: null,
      },
    })
    const handler = getHandler(IPC_CHANNELS.intentDraftSave)
    await handler(null, {
      threadId: 'thread-1',
      autoGenerate: true,
      what: '',
      why: '',
      outOfScopeText: '',
      touchedByUser: false,
      basedOnIntentVersion: null,
    })
    expect(saveIntentDraft).toHaveBeenCalledWith({
      threadId: 'thread-1',
      autoGenerate: true,
      what: '',
      why: '',
      outOfScopeText: '',
      touchedByUser: false,
      basedOnIntentVersion: null,
    })
  })

  it('routes intentDraft:generate to session.generateIntentDraft', async () => {
    generateIntentDraft.mockResolvedValue({ draft: null })
    const handler = getHandler(IPC_CHANNELS.intentDraftGenerate)
    await handler(null, { threadId: 'thread-1', sourceTurnId: 'turn-2' })
    expect(generateIntentDraft).toHaveBeenCalledWith({
      threadId: 'thread-1',
      sourceTurnId: 'turn-2',
    })
  })

  it('routes intentDraft:clear to session.clearIntentDraft', async () => {
    clearIntentDraft.mockResolvedValue({ ok: true })
    const handler = getHandler(IPC_CHANNELS.intentDraftClear)
    await handler(null, { threadId: 'thread-1' })
    expect(clearIntentDraft).toHaveBeenCalledWith({ threadId: 'thread-1' })
  })
})
