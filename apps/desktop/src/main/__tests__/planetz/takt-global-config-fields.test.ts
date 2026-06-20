import { describe, expect, it } from 'vitest'
import { materializeTaktGlobalConfigFields } from '../../planetz/takt-global-config-fields.js'

describe('materializeTaktGlobalConfigFields', () => {
  it('removes stale persona_providers and rate_limit_fallback when engine clears them', () => {
    const merged = materializeTaktGlobalConfigFields(
      {},
      {
        persona_providers: { coder: { provider: 'anthropic' } },
        rate_limit_fallback: { switch_chain: [{ provider: 'openai' }] },
        api_keys: { openai: 'sk-test' },
      },
    )
    expect(merged.persona_providers).toBeUndefined()
    expect(merged.rate_limit_fallback).toBeUndefined()
    expect(merged.api_keys).toEqual({ openai: 'sk-test' })
  })

  it('removes stale provider and model when engine clears workspace defaults', () => {
    const merged = materializeTaktGlobalConfigFields(
      {},
      { provider: 'openai', model: 'gpt-4', api_keys: { openai: 'sk' } },
    )
    expect(merged.provider).toBeUndefined()
    expect(merged.model).toBeUndefined()
    expect(merged.api_keys).toEqual({ openai: 'sk' })
  })

  it('writes persona_providers when engine has entries', () => {
    const merged = materializeTaktGlobalConfigFields(
      { persona_providers: { coder: { provider: 'cursor', model: 'auto' } } },
      { persona_providers: { old: 'x' } },
    )
    expect(merged.persona_providers).toEqual({
      coder: { provider: 'cursor', model: 'auto' },
    })
  })

  it('forces workflow_abort and run_abort notification events off for Planetz-owned notifications', () => {
    const merged = materializeTaktGlobalConfigFields(
      {},
      {
        notification_sound_events: {
          workflow_complete: true,
          workflow_abort: true,
          run_abort: true,
        },
      },
    )
    expect(merged.notification_sound_events).toEqual({
      workflow_complete: true,
      workflow_abort: false,
      run_abort: false,
    })
  })
})
