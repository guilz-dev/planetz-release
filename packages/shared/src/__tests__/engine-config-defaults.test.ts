import { describe, expect, it } from 'vitest'
import {
  applyEngineConfigRuntimeDefaults,
  DEFAULT_ENGINE_CONCURRENCY,
  engineConfigForFormState,
  engineLanguageFromUiLanguage,
  finalizeEngineConfigForPersist,
} from '../engine-config-defaults.js'

describe('engine-config-defaults', () => {
  it('maps UI language to engine language', () => {
    expect(engineLanguageFromUiLanguage('ja')).toBe('ja')
    expect(engineLanguageFromUiLanguage('en')).toBe('en')
  })

  it('form state omits language and presets concurrency', () => {
    const form = engineConfigForFormState({ language: 'ja', concurrency: 3, provider: 'cursor' })
    expect(form.language).toBeUndefined()
    expect(form.concurrency).toBe(3)
    expect(form.provider).toBe('cursor')
  })

  it('form state uses default concurrency when missing', () => {
    const form = engineConfigForFormState({ provider: 'cursor' })
    expect(form.concurrency).toBe(DEFAULT_ENGINE_CONCURRENCY)
  })

  it('finalize applies UI language and default concurrency', () => {
    const saved = finalizeEngineConfigForPersist({ provider: 'cursor', language: 'ja' }, 'en')
    expect(saved.language).toBe('en')
    expect(saved.concurrency).toBe(DEFAULT_ENGINE_CONCURRENCY)
    expect(saved.provider).toBe('cursor')
  })

  it('applyEngineConfigRuntimeDefaults enables providerEvents when unset', () => {
    const applied = applyEngineConfigRuntimeDefaults({ provider: 'cursor' })
    expect((applied as { logging?: { providerEvents?: boolean } }).logging?.providerEvents).toBe(
      true,
    )
  })

  it('applyEngineConfigRuntimeDefaults preserves explicit providerEvents', () => {
    const applied = applyEngineConfigRuntimeDefaults({
      logging: { providerEvents: false },
    } as import('../engine-config-schema.js').EngineConfig)
    expect((applied as { logging?: { providerEvents?: boolean } }).logging?.providerEvents).toBe(
      false,
    )
  })
})
