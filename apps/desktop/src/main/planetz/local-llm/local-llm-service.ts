import {
  type EngineConfig,
  mergeEngineConfigPreview,
  type OllamaHealthGetInput,
} from '@planetz/shared'
import type { OllamaHealthMonitor } from '../ollama-health-monitor.js'
import type { OllamaHealthSnapshot } from '../ollama-health-snapshot.js'
import type { OllamaLiveModelsResult } from '../ollama-model-discovery.js'
import type { LocalLlmAdapter, LocalLlmProviderId } from './local-llm-adapter.js'
import {
  createDefaultLocalLlmRegistry,
  type LocalLlmAdapterRegistry,
} from './local-llm-registry.js'

export type LocalLlmServiceDeps = {
  loadEffectiveEngineConfig: () => Promise<EngineConfig>
}

let defaultService: LocalLlmService | null = null

export function createLocalLlmService(
  deps: LocalLlmServiceDeps,
  registry: LocalLlmAdapterRegistry = createDefaultLocalLlmRegistry(),
): LocalLlmService {
  return new LocalLlmService(deps, registry)
}

export function configureDefaultLocalLlmService(deps: LocalLlmServiceDeps): LocalLlmService {
  defaultService = createLocalLlmService(deps)
  return defaultService
}

export function getDefaultLocalLlmService(): LocalLlmService {
  if (!defaultService) {
    defaultService = createLocalLlmService({
      loadEffectiveEngineConfig: async () => {
        throw new Error(
          'LocalLlmService: call configureDefaultLocalLlmService before using engine-dependent APIs',
        )
      },
    })
  }
  return defaultService
}

export function resetDefaultLocalLlmServiceForTests(): void {
  defaultService = null
}

export class LocalLlmService {
  constructor(
    private readonly deps: LocalLlmServiceDeps,
    private readonly registry: LocalLlmAdapterRegistry,
  ) {}

  getAdapter(providerId: string): LocalLlmAdapter | undefined {
    return this.registry.getForProvider(providerId)
  }

  buildRuntimeEnv(engine: EngineConfig): Record<string, string> {
    const adapter = this.registry.getForEngine(engine)
    if (!adapter) {
      return {}
    }
    return adapter.buildRuntimeEnv(engine)
  }

  async listLiveModels(
    providerId: LocalLlmProviderId,
    engine: EngineConfig,
    refresh: boolean,
  ): Promise<OllamaLiveModelsResult> {
    const adapter = this.registry.getForProvider(providerId)
    if (!adapter) {
      throw new Error(`No local LLM adapter registered for provider: ${providerId}`)
    }
    return adapter.listLiveModels(engine, refresh)
  }

  async checkHealth(engine: EngineConfig, refresh = true): Promise<OllamaHealthSnapshot | null> {
    const adapter = this.registry.getConfiguredAdapter(engine)
    if (!adapter) {
      return null
    }
    return adapter.checkHealth(engine, refresh)
  }

  async getOllamaHealth(
    input: OllamaHealthGetInput | undefined,
    monitor: OllamaHealthMonitor,
  ): Promise<OllamaHealthSnapshot | null> {
    if (input?.engineConfigPreview) {
      const engine = await this.resolveEngineForLocalLlm(input.engineConfigPreview)
      return this.checkHealth(engine, true)
    }
    const snapshot = monitor.getSnapshot()
    if (snapshot) {
      return snapshot
    }
    return monitor.poll()
  }

  async resolveEngineForLocalLlm(preview?: EngineConfig): Promise<EngineConfig> {
    const effective = await this.deps.loadEffectiveEngineConfig()
    return mergeEngineConfigPreview(effective, preview)
  }

  async pullModel(
    providerId: LocalLlmProviderId,
    model: string,
    engine: EngineConfig,
  ): Promise<void> {
    const adapter = this.registry.getForProvider(providerId)
    if (!adapter?.pullModel) {
      throw new Error(`Pull is not supported for provider: ${providerId}`)
    }
    await adapter.pullModel(engine, model)
  }

  async deleteModel(
    providerId: LocalLlmProviderId,
    model: string,
    engine: EngineConfig,
  ): Promise<void> {
    const adapter = this.registry.getForProvider(providerId)
    if (!adapter?.deleteModel) {
      throw new Error(`Delete is not supported for provider: ${providerId}`)
    }
    await adapter.deleteModel(engine, model)
  }
}
