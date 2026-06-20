import {
  readEffortFromProviderOptions,
  writeEffortToProviderOptions,
} from './effort-provider-mapping.js'
import type { EngineConfig } from './engine-config-schema.js'

export function readEffortFromEngineConfig(
  config: EngineConfig | null | undefined,
): string | undefined {
  if (!config) return undefined
  return readEffortFromProviderOptions(
    config.provider,
    (config as Record<string, unknown>).provider_options,
  )
}

export function writeEffortToEngineConfig(
  config: EngineConfig,
  effort: string | undefined,
): EngineConfig {
  const existing = (config as Record<string, unknown>).provider_options
  const provider_options = writeEffortToProviderOptions(config.provider, effort, existing)
  const next = { ...config } as EngineConfig & { provider_options?: Record<string, unknown> }
  if (provider_options) {
    next.provider_options = provider_options
  } else {
    delete next.provider_options
  }
  return next
}
