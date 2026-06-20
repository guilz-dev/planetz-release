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
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import type { AppState } from '@planetz/shared'
import type { AppSession } from '../../app-session.js'
import type { IpcContext } from '../ipc-context.js'
import { registerWorkspaceIpc } from '../register-workspace-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('registerWorkspaceIpc workspace:get', () => {
  const waitForStartupSettled = vi.fn()
  const getState = vi.fn()
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const ctx = {
    session: {
      waitForStartupSettled,
      workspacePath: '/tmp/workspace',
      getState,
    } as Pick<AppSession, 'waitForStartupSettled' | 'workspacePath' | 'getState'>,
    getWindow: () => null,
    broadcast: {
      broadcastNow: vi.fn(),
    },
  } as unknown as IpcContext

  beforeEach(() => {
    handleMock.mockClear()
    waitForStartupSettled.mockReset()
    getState.mockReset()
    warnSpy.mockClear()
    registerWorkspaceIpc(ctx)
  })

  afterEach(() => {
    warnSpy.mockClear()
  })

  it('waits startup restore before reading state snapshot', async () => {
    const deferred = createDeferred<'settled'>()
    const state = { workspace: { path: '/tmp/workspace', bootstrap: 'takt_ready' } } as AppState
    waitForStartupSettled.mockReturnValueOnce(deferred.promise)
    getState.mockReturnValueOnce(state)
    const handler = getHandler(IPC_CHANNELS.workspaceGet)

    const resultPromise = handler(null, null)
    await Promise.resolve()

    expect(waitForStartupSettled).toHaveBeenCalledTimes(1)
    expect(getState).not.toHaveBeenCalled()

    deferred.resolve('settled')
    await expect(resultPromise).resolves.toEqual({
      path: '/tmp/workspace',
      state,
    })
  })

  it('returns snapshot and warns when startup wait timed out', async () => {
    const state = { workspace: { path: '/tmp/workspace', bootstrap: 'partial_takt' } } as AppState
    waitForStartupSettled.mockResolvedValueOnce('timed_out')
    getState.mockReturnValueOnce(state)
    const handler = getHandler(IPC_CHANNELS.workspaceGet)

    await expect(handler(null, null)).resolves.toEqual({
      path: '/tmp/workspace',
      state,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      '[workspace-ipc] startup restore wait timed out; returning current workspace snapshot',
    )
  })
})
