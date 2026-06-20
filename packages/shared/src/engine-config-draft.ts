import { finalizeEngineConfigForPersist } from './engine-config-defaults.js'
import type { EngineConfig, RateLimitSwitchEntry } from './engine-config-schema.js'
import { type PersonaProviderRow, rowsToPersonaProviders } from './persona-providers-form.js'
import type { UiLanguage } from './ui-config-ui.js'

export { engineConfigForFormState } from './engine-config-defaults.js'

export function switchChainFromEngineConfig(config: EngineConfig): RateLimitSwitchEntry[] {
  return config.rate_limit_fallback?.switch_chain ?? []
}

export interface BuildEngineConfigForSaveInput {
  formConfig: EngineConfig
  personaRows: PersonaProviderRow[]
  switchChain: RateLimitSwitchEntry[]
  uiLanguage: UiLanguage
}

export function buildEngineConfigForSave(input: BuildEngineConfigForSaveInput): EngineConfig {
  const merged: EngineConfig = {
    ...input.formConfig,
    persona_providers: rowsToPersonaProviders(input.personaRows),
    rate_limit_fallback:
      input.switchChain.length > 0 ? { switch_chain: input.switchChain } : undefined,
  }
  return finalizeEngineConfigForPersist(merged, input.uiLanguage)
}
