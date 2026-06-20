import { describe, expect, it } from 'vitest'
import { applyEngineConfigPatch } from '../engine-config-merge-patch.js'

describe('applyEngineConfigPatch', () => {
  it('removes cleared persona_providers and rate_limit_fallback', () => {
    const merged = applyEngineConfigPatch(
      {
        provider: 'openai',
        persona_providers: { coder: { provider: 'anthropic' } },
        rate_limit_fallback: { switch_chain: [{ provider: 'openai' }] },
      },
      { persona_providers: {}, rate_limit_fallback: { switch_chain: [] } },
    )
    expect(merged.persona_providers).toBeUndefined()
    expect(merged.rate_limit_fallback).toBeUndefined()
    expect(merged.provider).toBe('openai')
  })

  it('removes cleared provider and model', () => {
    const merged = applyEngineConfigPatch(
      { provider: 'cursor', model: 'auto', persona_providers: { a: 'openai' } },
      { provider: '', model: undefined },
    )
    expect(merged.provider).toBeUndefined()
    expect(merged.model).toBeUndefined()
    expect(merged.persona_providers).toEqual({ a: 'openai' })
  })

  it('merges non-clearing patches', () => {
    const merged = applyEngineConfigPatch(
      { provider: 'openai' },
      { model: 'gpt-4', persona_providers: { coder: { provider: 'cursor' } } },
    )
    expect(merged).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      persona_providers: { coder: { provider: 'cursor' } },
    })
  })
})
