import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('../planetz/ollama-model-discovery.js', () => ({
  fetchOllamaLiveModels: vi.fn(async () => ({
    models: [],
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    error: 'ollama unreachable',
  })),
}))

import { execa } from 'execa'
import { fetchOllamaLiveModels } from '../planetz/ollama-model-discovery.js'
import { detectRuntimeProviderIds } from '../planetz/provider-runtime-detection.js'

describe('detectRuntimeProviderIds', () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    vi.mocked(execa).mockReset()
    vi.mocked(fetchOllamaLiveModels).mockReset()
    vi.mocked(fetchOllamaLiveModels).mockResolvedValue({
      models: [],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      error: 'ollama unreachable',
    })
    process.env = { ...envBackup }
  })

  it('detects providers from CLI, env vars, and copilot auth', async () => {
    process.env.TAKT_ANTHROPIC_API_KEY = 'test-anthropic'
    process.env.OPENAI_API_KEY = 'test-openai'
    vi.mocked(fetchOllamaLiveModels).mockResolvedValue({
      models: [{ id: 'llama3.2:latest', label: 'llama3.2:latest' }],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    } as never)

    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' || command === 'where') {
        if (target === 'claude') return { exitCode: 0 } as never
        if (target === 'cursor-agent') return { exitCode: 0 } as never
        if (target === 'copilot') return { exitCode: 0 } as never
        if (target === 'gh') return { exitCode: 0 } as never
        return { exitCode: 1 } as never
      }
      if (command === 'copilot' && target === '--help') {
        return { exitCode: 0, stdout: '@github/copilot' } as never
      }
      if (command === 'gh' && target === 'auth') return { exitCode: 0 } as never
      return { exitCode: 1 } as never
    }) as never)

    const providers = await detectRuntimeProviderIds()

    expect(providers).toEqual([
      'claude',
      'claude-sdk',
      'claude-terminal',
      'codex',
      'copilot',
      'cursor',
      'ollama',
    ])
  })

  it('does not detect copilot without auth even when cli exists', async () => {
    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' && target === 'copilot') return { exitCode: 0 } as never
      if (command === 'which' && target === 'gh') return { exitCode: 1 } as never
      if (command === 'copilot' && target === '--help') {
        return { exitCode: 0, stdout: '@github/copilot' } as never
      }
      return { exitCode: 1 } as never
    }) as never)

    const providers = await detectRuntimeProviderIds()

    expect(providers).toEqual([])
  })

  it('does not detect cursor from api key alone when cli is missing', async () => {
    process.env.TAKT_CURSOR_API_KEY = 'cursor-api-key'
    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' && target === 'cursor-agent') return { exitCode: 1 } as never
      return { exitCode: 1 } as never
    }) as never)

    const providers = await detectRuntimeProviderIds()

    expect(providers).toEqual([])
  })

  it('does not treat AWS Copilot CLI as GitHub Copilot', async () => {
    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' && target === 'copilot') return { exitCode: 0 } as never
      if (command === 'copilot' && target === '--help') {
        return {
          exitCode: 0,
          stdout: 'Launch and manage containerized applications on AWS.',
        } as never
      }
      return { exitCode: 1 } as never
    }) as never)

    const providers = await detectRuntimeProviderIds()

    expect(providers).toEqual([])
  })

  it('returns empty list when no probes match', async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 1 } as never)

    const providers = await detectRuntimeProviderIds()

    expect(providers).toEqual([])
  })
})
