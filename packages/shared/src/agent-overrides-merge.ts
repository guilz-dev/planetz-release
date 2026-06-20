import type { AgentOverrides } from './agent-overrides-schema.js'
import type { EngineConfig, PersonaProviderEntry } from './engine-config-schema.js'

/** Merge persona provider maps; `override` entries win per key. */
export function mergePersonaProviders(
  base: Record<string, PersonaProviderEntry> | undefined,
  override: Record<string, PersonaProviderEntry> | undefined,
): Record<string, PersonaProviderEntry> | undefined {
  if (!base && !override) return undefined
  if (!override || Object.keys(override).length === 0) return base
  if (!base || Object.keys(base).length === 0) return override
  return { ...base, ...override }
}

/** Apply `.planetz/orbit/agents/overrides.yaml` on top of engine config for runtime/catalog. */
export function buildEffectiveEngineConfig(
  engine: EngineConfig,
  overrides: AgentOverrides,
): EngineConfig {
  const overrideMap = overrides.persona_providers
  if (!overrideMap || Object.keys(overrideMap).length === 0) return engine
  const merged = mergePersonaProviders(engine.persona_providers, overrideMap)
  return { ...engine, persona_providers: merged }
}
