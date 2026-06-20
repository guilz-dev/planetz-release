import { describe, expect, it } from 'vitest'
import { createDefaultLocalLlmRegistry } from '../../planetz/local-llm/local-llm-registry.js'

describe('LocalLlmAdapterRegistry', () => {
  const registry = createDefaultLocalLlmRegistry()

  it('get returns adapter for registered provider id', () => {
    expect(registry.get('ollama')?.id).toBe('ollama')
  })

  it('get returns undefined for unknown provider id', () => {
    expect(registry.get('cursor')).toBeUndefined()
    expect(registry.get('lmstudio')).toBeUndefined()
  })

  it('getForEngine uses engine.provider only', () => {
    expect(
      registry.getForEngine({
        provider: 'cursor',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      }),
    ).toBeUndefined()
    expect(registry.getForEngine({ provider: 'ollama' })?.id).toBe('ollama')
  })
})
