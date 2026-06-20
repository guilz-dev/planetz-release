import type { EngineConfig } from './engine-config-schema.js'
import type { UiLanguage } from './ui-config-ui.js'

/** Default parallel task count for takt run (matches takt config.yaml default). */
export const DEFAULT_ENGINE_CONCURRENCY = 1

/** Engine `language` mirrors Planetz UI locale (`en` | `ja`). */
export function engineLanguageFromUiLanguage(language: UiLanguage): UiLanguage {
  return language
}

/** Form state: hide language (managed via UI settings) and preset concurrency. */
export function engineConfigForFormState(config: EngineConfig): EngineConfig {
  const { persona_providers: _personas, language: _language, ...form } = config
  return {
    ...form,
    concurrency: config.concurrency ?? DEFAULT_ENGINE_CONCURRENCY,
  }
}

type EngineLoggingConfig = {
  providerEvents?: boolean
}

function readEngineLogging(config: EngineConfig): EngineLoggingConfig {
  const logging = (config as Record<string, unknown>).logging
  if (logging && typeof logging === 'object' && !Array.isArray(logging)) {
    return logging as EngineLoggingConfig
  }
  return {}
}

/** In-memory and persisted defaults (e.g. Orbit provider-events JSONL). */
export function applyEngineConfigRuntimeDefaults(config: EngineConfig): EngineConfig {
  const logging = readEngineLogging(config)
  if (typeof logging.providerEvents === 'boolean') {
    return config
  }
  return {
    ...config,
    logging: { ...logging, providerEvents: true },
  } as EngineConfig
}

/** Persisted config: sync language from Planetz UI and ensure concurrency default. */
export function finalizeEngineConfigForPersist(
  config: EngineConfig,
  uiLanguage: UiLanguage,
): EngineConfig {
  const { language: _ignored, ...rest } = config
  return applyEngineConfigRuntimeDefaults({
    ...rest,
    language: engineLanguageFromUiLanguage(uiLanguage),
    concurrency: config.concurrency ?? DEFAULT_ENGINE_CONCURRENCY,
  })
}
