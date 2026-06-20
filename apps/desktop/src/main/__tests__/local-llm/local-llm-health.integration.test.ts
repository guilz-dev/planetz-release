import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalLlmService,
  resetDefaultLocalLlmServiceForTests,
} from '../../planetz/local-llm/local-llm-service.js'
import { OllamaHealthMonitor } from '../../planetz/ollama-health-monitor.js'
import { clearOllamaLiveModelsCacheForTests } from '../../planetz/ollama-model-discovery.js'

describe('OllamaHealthMonitor with LocalLlmService', () => {
  afterEach(() => {
    resetDefaultLocalLlmServiceForTests()
    clearOllamaLiveModelsCacheForTests()
    vi.unstubAllGlobals()
  })

  it('poll returns null when local LLM is not configured', async () => {
    const service = createLocalLlmService({
      loadEffectiveEngineConfig: async () => ({ provider: 'cursor', model: 'auto' }),
    })
    const monitor = new OllamaHealthMonitor(service)
    monitor.start(async () => ({ provider: 'cursor', model: 'auto' }))
    await expect(monitor.poll()).resolves.toBeNull()
    monitor.stop()
  })

  it('poll stores healthy snapshot via service.checkHealth', async () => {
    clearOllamaLiveModelsCacheForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3' }] }),
      })),
    )
    const service = createLocalLlmService({
      loadEffectiveEngineConfig: async () => ({ provider: 'ollama', model: 'llama3' }),
    })
    const monitor = new OllamaHealthMonitor(service)
    monitor.start(async () => ({ provider: 'ollama', model: 'llama3' }))
    const snapshot = await monitor.poll()
    expect(snapshot?.status).toBe('healthy')
    expect(monitor.getSnapshot()?.status).toBe('healthy')
    monitor.stop()
  })
})

describe('LocalLlmService.getOllamaHealth', () => {
  afterEach(() => {
    resetDefaultLocalLlmServiceForTests()
    clearOllamaLiveModelsCacheForTests()
    vi.unstubAllGlobals()
  })

  it('returns cached monitor snapshot without polling', async () => {
    const service = createLocalLlmService({
      loadEffectiveEngineConfig: async () => ({ provider: 'ollama', model: 'x' }),
    })
    const cached = {
      status: 'degraded' as const,
      lastCheckedAt: new Date().toISOString(),
      modelCount: 1,
    }
    const poll = vi.fn()
    const result = await service.getOllamaHealth(undefined, {
      getSnapshot: () => cached,
      poll,
    } as unknown as OllamaHealthMonitor)
    expect(result).toEqual(cached)
    expect(poll).not.toHaveBeenCalled()
  })

  it('preview path resolves engine and checks health', async () => {
    clearOllamaLiveModelsCacheForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ models: [{ name: 'preview-model' }] }),
      })),
    )
    const service = createLocalLlmService({
      loadEffectiveEngineConfig: async () => ({
        provider: 'cursor',
        model: 'base',
      }),
    })
    const result = await service.getOllamaHealth(
      {
        engineConfigPreview: {
          provider: 'ollama',
          model: 'preview-model',
        },
      },
      {
        getSnapshot: () => null,
        poll: vi.fn(),
      } as unknown as OllamaHealthMonitor,
    )
    expect(result?.status).toBe('healthy')
    expect(result?.modelCount).toBe(1)
  })
})
