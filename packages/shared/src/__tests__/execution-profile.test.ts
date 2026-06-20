import { describe, expect, it } from 'vitest'
import { diffExecutionOverrides, resolveExecutionProfile } from '../execution-profile.js'

describe('resolveExecutionProfile', () => {
  it('prefers task overrides over engine defaults', () => {
    const profile = resolveExecutionProfile(
      { provider: 'openai', model: 'gpt-default' },
      { provider: 'anthropic', model: 'claude-override' },
    )
    expect(profile).toEqual({ provider: 'anthropic', model: 'claude-override' })
  })

  it('falls back to engine config when overrides omitted', () => {
    const profile = resolveExecutionProfile({ provider: 'openai', model: 'gpt-4' }, {})
    expect(profile).toEqual({ provider: 'openai', model: 'gpt-4' })
  })

  it('returns empty when neither layer specifies values', () => {
    expect(resolveExecutionProfile({}, {})).toEqual({})
  })

  it('uses workflow defaults between overrides and engine config', () => {
    const profile = resolveExecutionProfile(
      { provider: 'openai', model: 'gpt-engine' },
      {},
      { provider: 'anthropic', model: 'claude-wf' },
    )
    expect(profile).toEqual({ provider: 'anthropic', model: 'claude-wf' })
  })

  it('keeps task overrides above workflow and engine', () => {
    const profile = resolveExecutionProfile(
      { provider: 'openai', model: 'gpt-engine' },
      { model: 'claude-ui' },
      { provider: 'anthropic', model: 'claude-wf' },
    )
    expect(profile).toEqual({ provider: 'anthropic', model: 'claude-ui' })
  })
})

describe('diffExecutionOverrides', () => {
  it('omits fields that match resolved profile', () => {
    expect(
      diffExecutionOverrides(
        { provider: 'openai', model: 'gpt-4' },
        { provider: 'openai', model: 'gpt-4' },
      ),
    ).toEqual({})
  })

  it('keeps fields that differ from resolved profile', () => {
    expect(
      diffExecutionOverrides(
        { provider: 'anthropic', model: 'gpt-4' },
        { provider: 'openai', model: 'gpt-4' },
      ),
    ).toEqual({ provider: 'anthropic' })
  })
})
