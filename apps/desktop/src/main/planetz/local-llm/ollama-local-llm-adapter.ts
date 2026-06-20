import {
  type EngineConfig,
  isOllamaEngineConfigured,
  normalizeOllamaHostForEnv,
  readOllamaBaseUrl,
  resolveOllamaFetchOrigin,
} from '@planetz/shared'
import { deleteOllamaModel, pullOllamaModel } from '../ollama-admin-service.js'
import { buildOllamaHealthSnapshot, type OllamaHealthSnapshot } from '../ollama-health-snapshot.js'
import { fetchOllamaLiveModels, type OllamaLiveModelsResult } from '../ollama-model-discovery.js'
import type {
  LocalLlmAdapter,
  LocalLlmCapabilities,
  LocalLlmProviderId,
} from './local-llm-adapter.js'

const OLLAMA_CAPABILITIES: LocalLlmCapabilities = {
  supportsToolsExecution: false,
  supportsStructuredOutput: false,
  supportsModelPull: true,
  supportsModelDelete: true,
}

export class OllamaLocalLlmAdapter implements LocalLlmAdapter {
  readonly id: LocalLlmProviderId = 'ollama'
  readonly capabilities = OLLAMA_CAPABILITIES

  isConfigured(engine: EngineConfig | null | undefined): boolean {
    return isOllamaEngineConfigured(engine)
  }

  buildRuntimeEnv(engine: EngineConfig): Record<string, string> {
    if (engine.provider?.trim() !== 'ollama') {
      return {}
    }
    return {
      OLLAMA_HOST: normalizeOllamaHostForEnv(readOllamaBaseUrl(engine)),
    }
  }

  listLiveModels(engine: EngineConfig, refresh: boolean): Promise<OllamaLiveModelsResult> {
    return fetchOllamaLiveModels({ refresh, engineConfig: engine })
  }

  async checkHealth(engine: EngineConfig, refresh = true): Promise<OllamaHealthSnapshot> {
    const started = Date.now()
    const result = await fetchOllamaLiveModels({ refresh, engineConfig: engine })
    return buildOllamaHealthSnapshot(result, Date.now() - started)
  }

  async pullModel(engine: EngineConfig, model: string): Promise<void> {
    await pullOllamaModel({ model, engineConfig: engine })
  }

  async deleteModel(engine: EngineConfig, model: string): Promise<void> {
    await deleteOllamaModel({ model, engineConfig: engine })
  }

  /** Exposed for tests and diagnostics; not part of `LocalLlmAdapter`. */
  resolveOrigin(engine: EngineConfig): string {
    return resolveOllamaFetchOrigin(engine)
  }
}
