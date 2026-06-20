import { afterEach, describe, expect, it } from 'vitest'
import {
  createLocalLlmService,
  resetDefaultLocalLlmServiceForTests,
} from '../../planetz/local-llm/local-llm-service.js'
import { clearOllamaLiveModelsCacheForTests } from '../../planetz/ollama-model-discovery.js'

describe('LocalLlmService', () => {
  afterEach(() => {
    resetDefaultLocalLlmServiceForTests()
    clearOllamaLiveModelsCacheForTests()
  })

  it('resolveEngineForLocalLlm merges preview', async () => {
    const service = createLocalLlmService({
      loadEffectiveEngineConfig: async () => ({
        provider: 'ollama',
        model: 'base',
      }),
    })
    const merged = await service.resolveEngineForLocalLlm({ model: 'preview-model' })
    expect(merged.model).toBe('preview-model')
    expect(merged.provider).toBe('ollama')
  })

  it('buildRuntimeEnv delegates to ollama adapter', () => {
    const service = createLocalLlmService({
      loadEffectiveEngineConfig: async () => ({ provider: 'cursor', model: 'auto' }),
    })
    expect(
      service.buildRuntimeEnv({
        provider: 'ollama',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      }),
    ).toEqual({ OLLAMA_HOST: '127.0.0.1:11434' })
  })
})
