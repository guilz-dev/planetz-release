import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isGitHubCopilotCliAvailable: vi.fn(),
  listModels: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('../planetz/copilot-cli-readiness.js', () => ({
  isGitHubCopilotCliAvailable: mocks.isGitHubCopilotCliAvailable,
}))

vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: vi.fn().mockImplementation(() => ({
    start: mocks.start,
    listModels: mocks.listModels,
    stop: mocks.stop,
  })),
}))

import {
  clearCopilotLiveModelsCacheForTests,
  fetchCopilotLiveModels,
} from '../planetz/copilot-model-discovery.js'

describe('fetchCopilotLiveModels', () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    clearCopilotLiveModelsCacheForTests()
    mocks.isGitHubCopilotCliAvailable.mockReset()
    mocks.listModels.mockReset()
    mocks.start.mockReset()
    mocks.stop.mockReset()
    process.env = { ...envBackup }
  })

  it('skips SDK when BYOK base URL is configured', async () => {
    process.env.COPILOT_PROVIDER_BASE_URL = 'http://localhost:11434/v1'

    const result = await fetchCopilotLiveModels()

    expect(result.models).toEqual([])
    expect(result.error).toContain('custom provider base URL')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('returns error when GitHub Copilot CLI is unavailable', async () => {
    mocks.isGitHubCopilotCliAvailable.mockResolvedValue(false)

    const result = await fetchCopilotLiveModels()

    expect(result.models).toEqual([])
    expect(result.error).toContain('GitHub Copilot CLI not found')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('lists models from SDK and always stops the client', async () => {
    mocks.isGitHubCopilotCliAvailable.mockResolvedValue(true)
    mocks.start.mockResolvedValue(undefined)
    mocks.listModels.mockResolvedValue([
      { id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex', policy: { state: 'enabled' } },
      { id: 'auto', name: 'Auto' },
    ])
    mocks.stop.mockResolvedValue(undefined)

    const result = await fetchCopilotLiveModels()

    expect(result.models).toEqual([
      { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
      { id: 'auto', label: 'Auto' },
    ])
    expect(result.error).toBeUndefined()
    expect(mocks.stop).toHaveBeenCalledOnce()
  })

  it('stops the client when listModels fails', async () => {
    mocks.isGitHubCopilotCliAvailable.mockResolvedValue(true)
    mocks.start.mockResolvedValue(undefined)
    mocks.listModels.mockRejectedValue(new Error('not authenticated'))
    mocks.stop.mockResolvedValue(undefined)

    const result = await fetchCopilotLiveModels()

    expect(result.models).toEqual([])
    expect(result.error).toContain('not authenticated')
    expect(mocks.stop).toHaveBeenCalledOnce()
  })

  it('does not reuse cached github models when BYOK is configured', async () => {
    mocks.isGitHubCopilotCliAvailable.mockResolvedValue(true)
    mocks.start.mockResolvedValue(undefined)
    mocks.listModels.mockResolvedValue([{ id: 'gpt-5.3-codex', name: 'GPT-5.3-Codex' }])
    mocks.stop.mockResolvedValue(undefined)

    const initial = await fetchCopilotLiveModels()
    expect(initial.models).toEqual([{ id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' }])

    process.env.COPILOT_PROVIDER_BASE_URL = 'http://localhost:11434/v1'
    const byok = await fetchCopilotLiveModels()

    expect(byok.models).toEqual([])
    expect(byok.fromCache).toBe(false)
    expect(byok.error).toContain('custom provider base URL')
    expect(mocks.start).toHaveBeenCalledOnce()
  })

  it('stops the client when model discovery times out', async () => {
    mocks.isGitHubCopilotCliAvailable.mockResolvedValue(true)
    mocks.start.mockResolvedValue(undefined)
    mocks.listModels.mockImplementation(() => new Promise<never>(() => {}))
    mocks.stop.mockResolvedValue(undefined)

    const result = await fetchCopilotLiveModels({ timeoutMs: 1 })

    expect(result.models).toEqual([])
    expect(result.error).toContain('timed out')
    expect(mocks.stop).toHaveBeenCalledOnce()
  })
})
