import { describe, expect, it } from 'vitest'
import { isEngineExecutionDefaultsConfigured } from '../engine-config-setup.js'

describe('isEngineExecutionDefaultsConfigured', () => {
  it('returns false when provider or model is missing', () => {
    expect(isEngineExecutionDefaultsConfigured(null)).toBe(false)
    expect(isEngineExecutionDefaultsConfigured({})).toBe(false)
    expect(isEngineExecutionDefaultsConfigured({ provider: 'cursor' })).toBe(false)
    expect(isEngineExecutionDefaultsConfigured({ model: 'gpt-4' })).toBe(false)
    expect(isEngineExecutionDefaultsConfigured({ provider: '  ', model: 'x' })).toBe(false)
  })

  it('returns true when both provider and model are set', () => {
    expect(isEngineExecutionDefaultsConfigured({ provider: 'cursor', model: 'composer-1' })).toBe(
      true,
    )
    expect(
      isEngineExecutionDefaultsConfigured({ provider: ' anthropic ', model: ' claude ' }),
    ).toBe(true)
  })
})
