import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearOllamaLiveModelsCacheForTests,
  fetchOllamaLiveModels,
} from '../planetz/ollama-model-discovery.js'

describe('fetchOllamaLiveModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearOllamaLiveModelsCacheForTests()
  })

  it('parses models from /api/tags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:latest' }],
        }),
      })),
    )

    const result = await fetchOllamaLiveModels({ refresh: true })
    expect(result.models).toEqual([{ id: 'llama3.2:latest' }])
    expect(result.error).toBeUndefined()
  })

  it('returns error without throwing when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      })),
    )

    const result = await fetchOllamaLiveModels({ refresh: true })
    expect(result.models).toEqual([])
    expect(result.error).toContain('unavailable')
  })
})
