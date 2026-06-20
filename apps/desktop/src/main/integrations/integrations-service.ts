import type {
  AgentState,
  IntegrationAdapterId,
  IntegrationsState,
  LogEntry,
  UiConfig,
} from '@planetz/shared'
import { EXECUTOR_ID_CLAUDE, EXECUTOR_ID_CODEX, EXECUTOR_ID_CURSOR } from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { SidecarStore } from '../sidecar/sidecar-store.js'
import { HookServer, type HookServerHandlers } from './hook-server.js'
import { toHookServerStartError } from './hook-server-errors.js'

const DEFAULT_PORT = 17_840

/** Hook `/agents/log` lines retained per external agent (orbit-side buffer only). */
const AGENT_LOG_TAIL_MAX = 50

const ADAPTER_META: Record<
  IntegrationAdapterId,
  { displayName: string; description: string; agentId: string }
> = {
  cursor: {
    displayName: 'Cursor',
    description: 'Push agent state and logs from Cursor as an external agent.',
    agentId: EXECUTOR_ID_CURSOR,
  },
  codex: {
    displayName: 'Codex CLI',
    description: 'Forward Codex tool calls into the orbit task ledger.',
    agentId: EXECUTOR_ID_CODEX,
  },
  claude: {
    displayName: 'Claude Code',
    description: 'Mirror Claude Code sessions as external agent runtime.',
    agentId: EXECUTOR_ID_CLAUDE,
  },
}

export interface IntegrationsPersisted {
  hookServer: { enabled: boolean; port: number }
  adapters: { id: IntegrationAdapterId; enabled: boolean }[]
}

export class IntegrationsService {
  private configPatch: IntegrationsPersisted = {
    hookServer: { enabled: false, port: DEFAULT_PORT },
    adapters: (['cursor', 'codex', 'claude'] as const).map((id) => ({ id, enabled: false })),
  }

  private hasSecret = false
  private readonly hookServer = new HookServer()
  private agentOverlays = new Map<string, AgentState['status']>()
  private overlayTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private logTails = new Map<string, LogEntry[]>()
  private onChange: (() => void) | null = null

  constructor(private readonly sidecarStore: SidecarStore) {}

  setOnChange(listener: () => void): void {
    this.onChange = listener
  }

  hydrateFromConfig(config: UiConfig): void {
    if (config.integrations) {
      this.configPatch = {
        hookServer: { ...config.integrations.hookServer },
        adapters: config.integrations.adapters.map((a) => ({ ...a })),
      }
    }
  }

  async persist(paths: SidecarPaths, config: UiConfig): Promise<UiConfig> {
    const next: UiConfig = {
      ...config,
      integrations: {
        hookServer: {
          enabled: this.configPatch.hookServer.enabled,
          port: this.configPatch.hookServer.port,
        },
        adapters: this.configPatch.adapters.map((a) => ({ ...a })),
      },
    }
    await this.sidecarStore.saveConfig(paths, next)
    return next
  }

  getState(): IntegrationsState {
    return {
      hookServer: {
        enabled: this.configPatch.hookServer.enabled && this.hookServer.isRunning(),
        bind: '127.0.0.1',
        port: this.configPatch.hookServer.port,
        hasSecret: this.hasSecret,
      },
      adapters: (['cursor', 'codex', 'claude'] as const).map((id) => ({
        id,
        displayName: ADAPTER_META[id].displayName,
        enabled: this.configPatch.adapters.find((a) => a.id === id)?.enabled ?? false,
        description: ADAPTER_META[id].description,
      })),
    }
  }

  /** Idle external agents for enabled integration adapters (production projection). */
  buildIntegrationAgentTemplates(): AgentState[] {
    const now = new Date().toISOString()
    return this.configPatch.adapters
      .filter((adapter) => adapter.enabled)
      .map((adapter) => {
        const meta = ADAPTER_META[adapter.id]
        return {
          id: meta.agentId,
          displayName: `${meta.displayName} (external)`,
          runtime: 'external' as const,
          role: 'custom' as const,
          status: 'idle' as const,
          logTail: this.logTails.get(meta.agentId) ?? [],
          updatedAt: now,
        }
      })
  }

  applyAgentOverlays(agents: AgentState[]): AgentState[] {
    const now = new Date().toISOString()
    return agents.map((agent) => {
      const overlay = this.agentOverlays.get(agent.id)
      const storedTail = this.logTails.get(agent.id)
      if (!overlay && storedTail === undefined) return agent
      return {
        ...agent,
        ...(overlay ? { status: overlay } : {}),
        ...(storedTail !== undefined ? { logTail: storedTail } : {}),
        updatedAt: now,
      }
    })
  }

  async toggleHookServer(
    paths: SidecarPaths,
    config: UiConfig,
    input: { enabled: boolean; port?: number },
  ): Promise<{ state: IntegrationsState; config: UiConfig; bearerSecret?: string }> {
    if (input.port !== undefined) {
      this.configPatch.hookServer.port = input.port
    }

    if (!input.enabled) {
      this.configPatch.hookServer.enabled = false
      await this.hookServer.stop()
      this.hasSecret = false
      const nextConfig = await this.persist(paths, config)
      return { state: this.getState(), config: nextConfig }
    }

    this.configPatch.hookServer.enabled = true
    const port = this.configPatch.hookServer.port
    try {
      const handlers: HookServerHandlers = {
        onAgentPush: (payload) => this.handleAgentPush(payload.adapterId, payload.status),
        onAgentLog: (payload) => this.handleAgentLog(payload.adapterId, payload.message),
      }
      const { secret } = await this.hookServer.start(port, handlers)
      this.hasSecret = true
      const nextConfig = await this.persist(paths, config)
      return { state: this.getState(), config: nextConfig, bearerSecret: secret }
    } catch (error: unknown) {
      this.configPatch.hookServer.enabled = false
      this.hasSecret = false
      await this.hookServer.stop().catch(() => undefined)
      const nextConfig = await this.persist(paths, config)
      throw toHookServerStartError(error, port, nextConfig)
    }
  }

  async toggleAdapter(
    paths: SidecarPaths,
    config: UiConfig,
    id: IntegrationAdapterId,
    enabled: boolean,
  ): Promise<{ state: IntegrationsState; config: UiConfig }> {
    this.configPatch.adapters = this.configPatch.adapters.map((a) =>
      a.id === id ? { ...a, enabled } : a,
    )
    const nextConfig = await this.persist(paths, config)
    return { state: this.getState(), config: nextConfig }
  }

  pushExternalAgent(id: IntegrationAdapterId): void {
    this.handleAgentPush(id, 'working')
  }

  async dispose(): Promise<void> {
    for (const timer of this.overlayTimers.values()) {
      clearTimeout(timer)
    }
    this.overlayTimers.clear()
    this.logTails.clear()
    await this.hookServer.stop()
  }

  private handleAgentLog(adapterId: IntegrationAdapterId | undefined, message: string): void {
    const trimmed = message.trim()
    if (!trimmed) return
    const meta = adapterId ? ADAPTER_META[adapterId] : ADAPTER_META.cursor
    this.appendAgentLog(meta.agentId, trimmed)
  }

  private appendAgentLog(agentId: string, message: string): void {
    const tail = [
      ...(this.logTails.get(agentId) ?? []),
      { at: new Date().toISOString(), level: 'info' as const, message },
    ]
    this.logTails.set(
      agentId,
      tail.length > AGENT_LOG_TAIL_MAX ? tail.slice(-AGENT_LOG_TAIL_MAX) : tail,
    )
    this.onChange?.()
  }

  private handleAgentPush(
    adapterId: IntegrationAdapterId | undefined,
    status: string | undefined,
  ): void {
    const id = adapterId ? ADAPTER_META[adapterId].agentId : ADAPTER_META.cursor.agentId
    const nextStatus = (status as AgentState['status'] | undefined) ?? 'working'
    this.agentOverlays.set(id, nextStatus)

    const prev = this.overlayTimers.get(id)
    if (prev) clearTimeout(prev)
    const timer = setTimeout(() => {
      this.agentOverlays.delete(id)
      this.overlayTimers.delete(id)
      this.onChange?.()
    }, 3000)
    this.overlayTimers.set(id, timer)
    this.onChange?.()
  }
}
