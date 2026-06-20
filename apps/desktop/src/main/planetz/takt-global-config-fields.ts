import {
  applyEngineConfigRuntimeDefaults,
  DEFAULT_ENGINE_CONCURRENCY,
  type EngineConfig,
  setOrDeleteConfigField,
} from '@planetz/shared'

function engineProviderOptions(engine: EngineConfig): Record<string, unknown> | undefined {
  const raw = (engine as Record<string, unknown>).provider_options
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

/**
 * Fields written to isolated/global `config.yaml` from Planetz engine config.
 * Expects a full effective engine config (e.g. `loadEffectiveEngineConfig`); empty
 * `provider` / `model` / maps remove stale keys from the on-disk runtime file.
 */
export function materializeTaktGlobalConfigFields(
  engine: EngineConfig,
  mergedConfig: Record<string, unknown>,
): Record<string, unknown> {
  const hasPersonaProviders =
    !!engine.persona_providers && Object.keys(engine.persona_providers).length > 0
  const hasRateLimitFallback =
    !!engine.rate_limit_fallback?.switch_chain && engine.rate_limit_fallback.switch_chain.length > 0
  const provider = engine.provider?.trim()
  const model = engine.model?.trim()
  const providerOptions = engineProviderOptions(engine)
  const runtimeEngine = applyEngineConfigRuntimeDefaults(engine)
  const logging = (runtimeEngine as Record<string, unknown>).logging

  const next: Record<string, unknown> = {
    ...mergedConfig,
    language: engine.language ?? mergedConfig.language ?? 'en',
    concurrency: engine.concurrency ?? mergedConfig.concurrency ?? DEFAULT_ENGINE_CONCURRENCY,
    ...(providerOptions ? { provider_options: providerOptions } : {}),
    ...(logging && typeof logging === 'object' ? { logging } : {}),
  }

  setOrDeleteConfigField(next, 'provider', provider, !!provider)
  setOrDeleteConfigField(next, 'model', model, !!model)
  setOrDeleteConfigField(next, 'persona_providers', engine.persona_providers, hasPersonaProviders)
  setOrDeleteConfigField(
    next,
    'rate_limit_fallback',
    engine.rate_limit_fallback,
    hasRateLimitFallback,
  )

  const existingEvents = asNotificationSoundEvents(mergedConfig.notification_sound_events)
  next.notification_sound_events = {
    ...existingEvents,
    workflow_abort: false,
    run_abort: false,
  }

  return next
}

function asNotificationSoundEvents(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return { ...(value as Record<string, unknown>) }
}
