import { describe, expect, it } from 'vitest'
import { buildEffectiveEngineConfig, mergePersonaProviders } from '../agent-overrides-merge.js'

describe('mergePersonaProviders', () => {
  it('returns override map when base is empty', () => {
    expect(mergePersonaProviders(undefined, { coder: 'anthropic' })).toEqual({
      coder: 'anthropic',
    })
  })

  it('lets override win per persona key', () => {
    expect(
      mergePersonaProviders(
        { coder: { provider: 'openai', model: 'gpt' } },
        { coder: { provider: 'anthropic', model: 'claude' } },
      ),
    ).toEqual({
      coder: { provider: 'anthropic', model: 'claude' },
    })
  })
})

describe('buildEffectiveEngineConfig', () => {
  it('merges overrides into engine persona_providers', () => {
    const effective = buildEffectiveEngineConfig(
      { provider: 'openai', persona_providers: { reviewer: 'openai' } },
      { persona_providers: { coder: { provider: 'anthropic', model: 'claude' } } },
    )
    expect(effective.persona_providers).toEqual({
      reviewer: 'openai',
      coder: { provider: 'anthropic', model: 'claude' },
    })
    expect(effective.provider).toBe('openai')
  })

  it('returns engine unchanged when overrides are empty', () => {
    const engine = { provider: 'openai', model: 'gpt' }
    expect(buildEffectiveEngineConfig(engine, {})).toBe(engine)
  })
})
