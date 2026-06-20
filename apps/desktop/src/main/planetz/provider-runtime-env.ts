import type { EngineConfig } from '@planetz/shared'
import { getDefaultLocalLlmService } from './local-llm/local-llm-service.js'

/** Provider-specific process env overrides for bundled orbit / composer runner. */
export function resolveProviderRuntimeEnv(engine: EngineConfig): Record<string, string> {
  return getDefaultLocalLlmService().buildRuntimeEnv(engine)
}
