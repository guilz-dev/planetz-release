import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteOllamaModel,
  OllamaAdminRemoteDeleteError,
  pullOllamaModel,
} from '../planetz/ollama-admin-service.js'

describe('ollama admin service', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pulls a model via POST /api/pull', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
        }),
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await pullOllamaModel({
      model: 'llama3.2',
      engineConfig: {
        provider: 'ollama',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/pull',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('blocks delete on non-loopback origins', async () => {
    await expect(
      deleteOllamaModel({
        model: 'llama3.2',
        engineConfig: {
          provider: 'ollama',
          provider_options: { ollama: { base_url: 'http://192.168.0.5:11434' } },
        },
      }),
    ).rejects.toBeInstanceOf(OllamaAdminRemoteDeleteError)
  })
})
