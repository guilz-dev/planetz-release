import type { EngineConfig } from '@planetz/shared'
import type { LocalLlmAdapter, LocalLlmProviderId } from './local-llm-adapter.js'
import { OllamaLocalLlmAdapter } from './ollama-local-llm-adapter.js'

export function createDefaultLocalLlmRegistry(): LocalLlmAdapterRegistry {
  return new LocalLlmAdapterRegistry([new OllamaLocalLlmAdapter()])
}

export class LocalLlmAdapterRegistry {
  private readonly byId = new Map<LocalLlmProviderId, LocalLlmAdapter>()

  constructor(adapters: readonly LocalLlmAdapter[]) {
    for (const adapter of adapters) {
      this.byId.set(adapter.id, adapter)
    }
  }

  listIds(): LocalLlmProviderId[] {
    return [...this.byId.keys()]
  }

  get(id: string): LocalLlmAdapter | undefined {
    const key = id as LocalLlmProviderId
    if (!this.byId.has(key)) {
      return undefined
    }
    return this.byId.get(key)
  }

  /** Registered local LLM adapter for a provider id (live models / admin). */
  getForProvider(provider: string | undefined): LocalLlmAdapter | undefined {
    const trimmed = provider?.trim()
    if (!trimmed) return undefined
    return this.get(trimmed)
  }

  /**
   * Adapter for runtime env injection — uses `engine.provider` only (not `isConfigured`).
   */
  getForEngine(engine: EngineConfig): LocalLlmAdapter | undefined {
    return this.getForProvider(engine.provider)
  }

  /** First registered adapter that considers the engine configured (health polling). */
  getConfiguredAdapter(engine: EngineConfig | null | undefined): LocalLlmAdapter | undefined {
    if (!engine) return undefined
    for (const adapter of this.byId.values()) {
      if (adapter.isConfigured(engine)) {
        return adapter
      }
    }
    return undefined
  }
}
