import type { EngineConfig } from './engine-config-schema.js'

/** Top-level keys edited by the Orbit engine config form (not passthrough YAML). */
export const KNOWN_ENGINE_CONFIG_KEYS = new Set([
  'provider',
  'model',
  'language',
  'concurrency',
  'persona_providers',
  'rate_limit_fallback',
])

export function passthroughFromEngineConfig(config: EngineConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (!KNOWN_ENGINE_CONFIG_KEYS.has(key)) {
      out[key] = value
    }
  }
  return out
}

export function mergeEngineConfigPassthrough(
  config: EngineConfig,
  passthrough: Record<string, unknown>,
): EngineConfig {
  const next: EngineConfig = { ...config }
  for (const key of Object.keys(next)) {
    if (!KNOWN_ENGINE_CONFIG_KEYS.has(key)) {
      delete next[key]
    }
  }
  return { ...next, ...passthrough }
}
