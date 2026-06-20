import type { EngineConfig } from '@planetz/shared'
import type { OllamaHealthSnapshot } from '../ollama-health-snapshot.js'
import type { OllamaLiveModelsResult } from '../ollama-model-discovery.js'

export type LocalLlmProviderId = 'ollama'

export interface LocalLlmCapabilities {
  supportsToolsExecution: boolean
  supportsStructuredOutput: boolean
  supportsModelPull: boolean
  supportsModelDelete: boolean
}

export interface LocalLlmAdapter {
  readonly id: LocalLlmProviderId
  readonly capabilities: LocalLlmCapabilities

  /** Whether background health polling should run for this engine. */
  isConfigured(engine: EngineConfig | null | undefined): boolean

  /** Process env overrides when this adapter owns runtime injection (provider-scoped). */
  buildRuntimeEnv(engine: EngineConfig): Record<string, string>

  listLiveModels(engine: EngineConfig, refresh: boolean): Promise<OllamaLiveModelsResult>

  checkHealth(engine: EngineConfig, refresh?: boolean): Promise<OllamaHealthSnapshot>

  pullModel?(engine: EngineConfig, model: string): Promise<void>

  deleteModel?(engine: EngineConfig, model: string): Promise<void>
}
