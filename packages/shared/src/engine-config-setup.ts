import type { EngineConfig } from './engine-config-schema.js'

/** True when workspace engine-config has non-empty default provider and model. */
export function isEngineExecutionDefaultsConfigured(
  config: EngineConfig | null | undefined,
): boolean {
  return Boolean(config?.provider?.trim() && config?.model?.trim())
}
