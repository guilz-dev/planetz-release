import { describe, expect, it } from 'vitest'
import {
  collectModelOptions,
  collectProviderOptions,
  isModelInOptionList,
} from '../execution-provider-options.js'
import { selectVisibleProviderIds } from '../provider-visibility.js'

describe('collectProviderOptions', () => {
  it('includes catalog ids and engine-config values', () => {
    const providers = collectProviderOptions({
      engineConfig: {
        provider: 'custom-vendor',
        persona_providers: { coder: { provider: 'codex', model: 'gpt-5' } },
        rate_limit_fallback: { switch_chain: [{ provider: 'mock' }] },
      },
      currentProvider: 'claude-sdk',
    })
    expect(providers).toContain('claude-sdk')
    expect(providers).toContain('custom-vendor')
    expect(providers).toContain('codex')
    expect(providers).toContain('mock')
    for (const id of selectVisibleProviderIds()) {
      expect(providers).toContain(id)
    }
  })

  it('does not treat persona shorthand as a provider option', () => {
    const providers = collectProviderOptions({
      engineConfig: { persona_providers: { reviewer: 'anthropic' } },
    })
    expect(providers).not.toContain('anthropic')
    for (const id of selectVisibleProviderIds()) {
      expect(providers).toContain(id)
    }
  })

  it('prioritizes workspace-configured providers from catalog', () => {
    const providers = collectProviderOptions({
      catalog: {
        configuredProviders: ['codex', 'cursor'],
        runtimeDetectedProviders: [],
        modelsByProvider: { codex: ['gpt-5.2-codex'], cursor: ['auto'] },
        effortsByProvider: {},
      },
    })
    expect(providers.indexOf('codex')).toBeLessThan(providers.indexOf('cursor'))
    expect(providers).not.toContain('mock')
  })
})

describe('collectModelOptions', () => {
  it('merges engine models and hints when provider is set', () => {
    const models = collectModelOptions({
      engineConfig: { model: 'team-default', persona_providers: { coder: 'codex' } },
      currentProvider: 'claude-sdk',
      currentModel: 'claude-custom',
    })
    expect(models).toContain('team-default')
    expect(models).toContain('claude-custom')
    expect(models).toContain('claude-sonnet-4')
    expect(models).not.toContain('mock-model')
  })

  it('includes workflow defaults', () => {
    expect(collectProviderOptions({ workflowDefaults: { provider: 'wf-provider' } })).toContain(
      'wf-provider',
    )
    expect(
      collectModelOptions({
        workflowDefaults: { model: 'wf-model' },
        currentProvider: 'codex',
      }),
    ).toContain('wf-model')
  })

  it('filters persona and switch_chain models by selected provider', () => {
    const models = collectModelOptions({
      engineConfig: {
        persona_providers: {
          a: { provider: 'codex', model: 'gpt-5' },
          b: { provider: 'mock', model: 'mock-model' },
        },
        rate_limit_fallback: {
          switch_chain: [{ provider: 'codex', model: 'gpt-5.2-codex' }],
        },
      },
      currentProvider: 'codex',
    })
    expect(models).toContain('gpt-5')
    expect(models).toContain('gpt-5.2-codex')
    expect(models).not.toContain('mock-model')
  })

  it('does not include default model from other providers', () => {
    const models = collectModelOptions({
      engineConfig: { provider: 'cursor', model: 'composer-2.5' },
      currentProvider: 'codex',
    })
    expect(models).not.toContain('composer-2.5')
  })
})

describe('isModelInOptionList', () => {
  it('returns true for empty model', () => {
    expect(isModelInOptionList('', { currentProvider: 'codex' })).toBe(true)
  })

  it('returns false when model is not valid for provider', () => {
    expect(
      isModelInOptionList('mock-model', {
        engineConfig: { persona_providers: { a: { provider: 'mock', model: 'mock-model' } } },
        currentProvider: 'codex',
      }),
    ).toBe(false)
  })
})
