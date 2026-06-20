import { describe, expect, it } from 'vitest'
import { buildEngineConfigForSave, engineConfigForFormState } from '../engine-config-draft.js'

describe('engineConfigForFormState / buildEngineConfigForSave', () => {
  it('omits persona_providers from form state and restores on save', () => {
    const loaded = {
      provider: 'anthropic',
      persona_providers: { coder: { provider: 'openai', model: 'gpt' } },
      task_poll_interval_ms: 500,
    }
    const form = engineConfigForFormState(loaded)
    expect(form.persona_providers).toBeUndefined()
    expect(form.provider).toBe('anthropic')
    expect(form.task_poll_interval_ms).toBe(500)

    const saved = buildEngineConfigForSave({
      formConfig: form,
      uiLanguage: 'en',
      personaRows: [
        {
          persona: 'coder',
          mode: 'structured',
          shorthand: '',
          provider: 'anthropic',
          model: 'claude',
          type: '',
          effort: '',
        },
      ],
      switchChain: [{ provider: 'openai', model: 'gpt-4' }],
    })
    expect(saved.persona_providers).toEqual({ coder: { provider: 'anthropic', model: 'claude' } })
    expect(saved.rate_limit_fallback).toEqual({
      switch_chain: [{ provider: 'openai', model: 'gpt-4' }],
    })
    expect(saved.language).toBe('en')
    expect(saved.concurrency).toBe(1)
  })
})
