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
import { registerTaskIpc } from '../register-task-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerTaskIpc', () => {
  const runTaskNow = vi.fn()
  const createResultPr = vi.fn()
  const checkResultBranch = vi.fn()

  const ctx = {
    session: {
      runTaskNow,
      createResultPr,
      checkResultBranch,
    } as Pick<AppSession, 'runTaskNow' | 'createResultPr' | 'checkResultBranch'>,
    getWindow: () => null,
    broadcast: {
      broadcastNow: broadcastNowMock,
    },
  } as unknown as IpcContext

  beforeEach(() => {
    handleMock.mockClear()
    broadcastNowMock.mockClear()
    runTaskNow.mockReset()
    createResultPr.mockReset()
    checkResultBranch.mockReset()
    registerTaskIpc(ctx)
  })

  it('returns runTaskNow result from taskRunNow handler', async () => {
    const queued = { taskId: 'task-queued' }
    runTaskNow.mockResolvedValue(queued)
    const handler = getHandler(IPC_CHANNELS.taskRunNow)

    const result = await handler(null, { body: 'run now', workflow: 'default' })

    expect(runTaskNow).toHaveBeenCalledWith({
      body: 'run now',
      workflow: 'default',
      workflowMode: 'manual',
    })
    expect(result).toEqual(queued)
    expect(broadcastNowMock).toHaveBeenCalledTimes(1)
  })

  it('routes resultCreatePr to session.createResultPr and broadcasts', async () => {
    createResultPr.mockResolvedValue({
      status: 'created',
      pr: {
        number: 1,
        url: 'https://github.com/guilz-dev/planetz/pull/1',
        state: 'open',
        isDraft: false,
        headBranch: 'feature/demo',
        baseBranch: 'main',
      },
    })
    const handler = getHandler(IPC_CHANNELS.resultCreatePr)

    const result = await handler(null, {
      taskId: 'task-1',
      branch: 'feature/demo',
      title: 'Demo PR',
    })

    expect(createResultPr).toHaveBeenCalledWith({
      taskId: 'task-1',
      branch: 'feature/demo',
      title: 'Demo PR',
    })
    expect(result).toMatchObject({ status: 'created', pr: { number: 1 } })
    expect(broadcastNowMock).toHaveBeenCalledTimes(1)
  })

  it('routes resultCheckBranch to session.checkResultBranch', async () => {
    checkResultBranch.mockResolvedValue({ exists: true, defaultBaseBranch: 'main' })
    const handler = getHandler(IPC_CHANNELS.resultCheckBranch)

    const result = await handler(null, { taskId: 'task-1', branch: 'feature/demo' })

    expect(checkResultBranch).toHaveBeenCalledWith('task-1', 'feature/demo')
    expect(result).toEqual({ exists: true, defaultBaseBranch: 'main' })
    expect(broadcastNowMock).not.toHaveBeenCalled()
  })
})
