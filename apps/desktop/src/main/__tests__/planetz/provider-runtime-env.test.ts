import { describe, expect, it } from 'vitest'
import { resolveProviderRuntimeEnv } from '../../planetz/provider-runtime-env.js'

describe('resolveProviderRuntimeEnv', () => {
  it('returns OLLAMA_HOST for ollama provider', () => {
    const env = resolveProviderRuntimeEnv({
      provider: 'ollama',
      provider_options: { ollama: { base_url: 'http://127.0.0.1:11435' } },
    })
    expect(env.OLLAMA_HOST).toBe('127.0.0.1:11435')
  })

  it('returns empty env for non-ollama providers', () => {
    expect(resolveProviderRuntimeEnv({ provider: 'cursor' })).toEqual({})
  })
})
