import { type EngineConfig, LIVE_PROVIDER_MODELS_TTL_MS } from '@planetz/shared'
import type { LocalLlmService } from './local-llm/local-llm-service.js'
import type { OllamaHealthSnapshot } from './ollama-health-snapshot.js'

export type { OllamaHealthSnapshot, OllamaHealthStatus } from './ollama-health-snapshot.js'

export class OllamaHealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private snapshot: OllamaHealthSnapshot | null = null
  private loadEngineConfig: (() => Promise<EngineConfig | null>) | null = null

  constructor(private readonly localLlmService: LocalLlmService) {}

  start(loadEngineConfig: () => Promise<EngineConfig | null>): void {
    this.stop()
    this.loadEngineConfig = loadEngineConfig
    void this.poll()
    this.timer = setInterval(() => {
      void this.poll()
    }, LIVE_PROVIDER_MODELS_TTL_MS)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.loadEngineConfig = null
    this.snapshot = null
  }

  getSnapshot(): OllamaHealthSnapshot | null {
    return this.snapshot
  }

  async poll(): Promise<OllamaHealthSnapshot | null> {
    const load = this.loadEngineConfig
    if (!load) return null
    const engine = await load()
    if (!engine) {
      this.snapshot = null
      return null
    }
    this.snapshot = await this.localLlmService.checkHealth(engine, true)
    return this.snapshot
  }
}
