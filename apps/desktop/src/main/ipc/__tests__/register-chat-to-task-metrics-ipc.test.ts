import { IPC_CHANNELS } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'

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
import { registerChatToTaskMetricsIpc } from '../register-chat-to-task-metrics-ipc.js'

function getHandler(channel: string) {
  const call = handleMock.mock.calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerChatToTaskMetricsIpc', () => {
  it('records metrics via session', async () => {
    handleMock.mockClear()
    const recordChatToTaskMetric = vi.fn(async () => {})
    const session = { recordChatToTaskMetric } as unknown as AppSession
    registerChatToTaskMetricsIpc({ session } as IpcContext)

    const handler = getHandler(IPC_CHANNELS.chatToTaskMetricRecord)
    await handler({}, { event: 'chat_add_to_task_click' })

    expect(recordChatToTaskMetric).toHaveBeenCalledWith({ event: 'chat_add_to_task_click' })
  })

  it('rejects invalid payloads', async () => {
    handleMock.mockClear()
    const recordChatToTaskMetric = vi.fn(async () => {})
    const session = { recordChatToTaskMetric } as unknown as AppSession
    registerChatToTaskMetricsIpc({ session } as IpcContext)

    const handler = getHandler(IPC_CHANNELS.chatToTaskMetricRecord)
    await expect(handler({}, { event: 'not_a_metric' })).rejects.toThrow()
    expect(recordChatToTaskMetric).not.toHaveBeenCalled()
  })
})
