import type { EngineConfig } from './engine-config-schema.js'
import type { EngineConfigUpdateInput } from './ipc-schemas.js'

function isAbsentString(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0
}

function isEmptyRecord(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value as Record<string, unknown>).length === 0
}

function isEmptySwitchChain(value: EngineConfig['rate_limit_fallback'] | undefined): boolean {
  if (!value) return true
  const chain = value.switch_chain
  return !chain || chain.length === 0
}

/**
 * Merge a partial engine-config patch and drop keys the UI cleared.
 * Use before persisting sidecar `engine-config.yaml`.
 */
export function applyEngineConfigPatch(
  current: EngineConfig,
  patch: EngineConfigUpdateInput,
): EngineConfig {
  const merged: EngineConfig = { ...current, ...patch }

  if ('persona_providers' in patch && isEmptyRecord(patch.persona_providers)) {
    delete merged.persona_providers
  }
  if ('rate_limit_fallback' in patch && isEmptySwitchChain(patch.rate_limit_fallback)) {
    delete merged.rate_limit_fallback
  }
  if ('provider' in patch && isAbsentString(patch.provider)) {
    delete merged.provider
  }
  if ('model' in patch && isAbsentString(patch.model)) {
    delete merged.model
  }

  return merged
}
