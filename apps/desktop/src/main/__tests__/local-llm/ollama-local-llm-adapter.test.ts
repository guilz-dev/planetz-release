import { describe, expect, it, vi } from 'vitest'
import { OllamaLocalLlmAdapter } from '../../planetz/local-llm/ollama-local-llm-adapter.js'
import { buildOllamaHealthSnapshot } from '../../planetz/ollama-health-snapshot.js'
import { clearOllamaLiveModelsCacheForTests } from '../../planetz/ollama-model-discovery.js'

describe('OllamaLocalLlmAdapter', () => {
  const adapter = new OllamaLocalLlmAdapter()

  it('buildRuntimeEnv returns OLLAMA_HOST only when provider is ollama', () => {
    expect(
      adapter.buildRuntimeEnv({
        provider: 'ollama',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11435' } },
      }),
    ).toEqual({ OLLAMA_HOST: '127.0.0.1:11435' })
    expect(adapter.buildRuntimeEnv({ provider: 'cursor' })).toEqual({})
    expect(
      adapter.buildRuntimeEnv({
        provider: 'cursor',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      }),
    ).toEqual({})
  })

  it('isConfigured when provider is ollama or base_url is set', () => {
    expect(adapter.isConfigured({ provider: 'ollama' })).toBe(true)
    expect(
      adapter.isConfigured({
        provider: 'cursor',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      }),
    ).toBe(true)
    expect(adapter.isConfigured({ provider: 'cursor' })).toBe(false)
  })

  it('checkHealth maps tags result to snapshot', async () => {
    clearOllamaLiveModelsCacheForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3' }] }),
      })),
    )
    try {
      const snapshot = await adapter.checkHealth({ provider: 'ollama' }, true)
      expect(snapshot.status).toBe('healthy')
      expect(snapshot.modelCount).toBe(1)
    } finally {
      vi.unstubAllGlobals()
      clearOllamaLiveModelsCacheForTests()
    }
  })
})

describe('buildOllamaHealthSnapshot via adapter path', () => {
  it('marks degraded when error but cached models remain', () => {
    const snapshot = buildOllamaHealthSnapshot(
      {
        models: [{ id: 'a', label: 'a' }],
        fetchedAt: new Date().toISOString(),
        fromCache: true,
        error: 'timeout',
        errorCode: 'timeout',
      },
      5,
    )
    expect(snapshot.status).toBe('degraded')
  })
})
