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

import type { IpcContext } from '../ipc-context.js'
import { registerDesktopIpc } from '../register-desktop-ipc.js'

function getHandler(channel: string) {
  const calls = handleMock.mock.calls.filter(([ch]) => ch === channel)
  const call = calls.at(-1)
  if (!call) throw new Error(`no handler for ${channel}`)
  return call[1] as (_event: unknown, raw: unknown) => Promise<unknown>
}

describe('registerDesktopIpc', () => {
  const ctx = {} as IpcContext
  let previousPlanetzChatMode: string | undefined
  let previousPlanetzChatAgent: string | undefined
  let previousPlanetzChatGateway: string | undefined

  beforeEach(() => {
    handleMock.mockClear()
    previousPlanetzChatMode = process.env.PLANETZ_CHAT_MODE
    previousPlanetzChatAgent = process.env.PLANETZ_CHAT_AGENT_ENABLED
    previousPlanetzChatGateway = process.env.PLANETZ_CHAT_GATEWAY
    delete process.env.PLANETZ_CHAT_MODE
    delete process.env.PLANETZ_CHAT_AGENT_ENABLED
    delete process.env.PLANETZ_CHAT_GATEWAY
    registerDesktopIpc(ctx)
  })

  afterEach(() => {
    if (previousPlanetzChatMode === undefined) {
      delete process.env.PLANETZ_CHAT_MODE
    } else {
      process.env.PLANETZ_CHAT_MODE = previousPlanetzChatMode
    }
    if (previousPlanetzChatAgent === undefined) {
      delete process.env.PLANETZ_CHAT_AGENT_ENABLED
    } else {
      process.env.PLANETZ_CHAT_AGENT_ENABLED = previousPlanetzChatAgent
    }
    if (previousPlanetzChatGateway === undefined) {
      delete process.env.PLANETZ_CHAT_GATEWAY
    } else {
      process.env.PLANETZ_CHAT_GATEWAY = previousPlanetzChatGateway
    }
  })

  it('returns product defaults for desktop:getCapabilities', async () => {
    const handler = getHandler(IPC_CHANNELS.desktopGetCapabilities)
    await expect(handler(null, null)).resolves.toEqual({
      conversationModeEnabled: true,
      chatGateway: 'auto',
      devProvidersAvailable: false,
      chatAgentEnabled: true,
      chatAgentSupportByProvider: expect.objectContaining({ ollama: 'unsupported' }),
      chatMcpEnabledByProvider: expect.objectContaining({ 'claude-sdk': true, ollama: false }),
    })
  })

  it('disables conversation mode when PLANETZ_CHAT_MODE=0', async () => {
    process.env.PLANETZ_CHAT_MODE = '0'
    const handler = getHandler(IPC_CHANNELS.desktopGetCapabilities)
    await expect(handler(null, null)).resolves.toEqual({
      conversationModeEnabled: false,
      chatGateway: 'auto',
      devProvidersAvailable: false,
      chatAgentEnabled: false,
      chatAgentSupportByProvider: expect.objectContaining({ ollama: 'unsupported' }),
      chatMcpEnabledByProvider: expect.objectContaining({ ollama: false }),
    })
  })

  it('disables chat agent when PLANETZ_CHAT_AGENT_ENABLED=0', async () => {
    process.env.PLANETZ_CHAT_AGENT_ENABLED = '0'
    const handler = getHandler(IPC_CHANNELS.desktopGetCapabilities)
    const result = await handler(null, null)
    expect(result).toMatchObject({
      conversationModeEnabled: true,
      chatAgentEnabled: false,
    })
  })

  it('returns chatGateway override from PLANETZ_CHAT_GATEWAY', async () => {
    process.env.PLANETZ_CHAT_GATEWAY = 'mock'
    const handler = getHandler(IPC_CHANNELS.desktopGetCapabilities)
    await expect(handler(null, null)).resolves.toEqual({
      conversationModeEnabled: true,
      chatGateway: 'mock',
      devProvidersAvailable: false,
      chatAgentEnabled: true,
      chatAgentSupportByProvider: expect.objectContaining({ ollama: 'unsupported' }),
      chatMcpEnabledByProvider: expect.objectContaining({ ollama: false }),
    })
  })
})
