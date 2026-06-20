import {
  DEFAULT_CONFIG,
  EXECUTOR_ID_CURSOR,
  type IntegrationAdapterId,
  type LogEntry,
  type UiConfig,
} from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HookServer } from '../integrations/hook-server.js'
import { HookServerStartError } from '../integrations/hook-server-errors.js'
import {
  type IntegrationsPersisted,
  IntegrationsService,
} from '../integrations/integrations-service.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

type IntegrationsServiceTestAccess = {
  handleAgentLog(adapterId: IntegrationAdapterId | undefined, message: string): void
  logTails: Map<string, LogEntry[]>
  configPatch: IntegrationsPersisted
  buildIntegrationAgentTemplates(): ReturnType<
    IntegrationsService['buildIntegrationAgentTemplates']
  >
  applyAgentOverlays(
    agents: Parameters<IntegrationsService['applyAgentOverlays']>[0],
  ): ReturnType<IntegrationsService['applyAgentOverlays']>
  getState(): ReturnType<IntegrationsService['getState']>
}

function integrationsTestAccess(service: IntegrationsService): IntegrationsServiceTestAccess {
  return service as unknown as IntegrationsServiceTestAccess
}

function configWithHookEnabled(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
    watch: { autoStart: false },
    ui: { ...DEFAULT_CONFIG.ui },
    integrations: {
      hookServer: { enabled: true, port: 17_840 },
      adapters: [
        { id: 'cursor', enabled: false },
        { id: 'codex', enabled: false },
        { id: 'claude', enabled: false },
      ],
    },
  }
}

describe('IntegrationsService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rolls back hookServer.enabled and persists false when start fails with EADDRINUSE', async () => {
    const saveConfig = vi.fn(async (_paths: unknown, cfg: UiConfig) => cfg)
    const service = new IntegrationsService({ saveConfig } as never)
    service.hydrateFromConfig(configWithHookEnabled())
    const paths = mockSidecarPaths('/tmp/ws/.orbit')
    const config = configWithHookEnabled()

    vi.spyOn(HookServer.prototype, 'start').mockRejectedValue(
      Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' }),
    )

    await expect(service.toggleHookServer(paths, config, { enabled: true })).rejects.toBeInstanceOf(
      HookServerStartError,
    )

    expect(saveConfig).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        integrations: expect.objectContaining({
          hookServer: { enabled: false, port: 17_840 },
        }),
      }),
    )
    expect(service.getState().hookServer.enabled).toBe(false)
  })

  it('stores hook agent logs and applies them to agent overlays', () => {
    const service = integrationsTestAccess(new IntegrationsService({} as never))
    service.handleAgentLog('cursor', 'hook ping ok')
    service.handleAgentLog('cursor', 'step_start · implement')

    const templates = service.buildIntegrationAgentTemplates()
    expect(templates).toEqual([])

    service.configPatch.adapters = service.configPatch.adapters.map((a) =>
      a.id === 'cursor' ? { ...a, enabled: true } : a,
    )
    const enabledTemplates = service.buildIntegrationAgentTemplates()
    expect(enabledTemplates[0]?.id).toBe(EXECUTOR_ID_CURSOR)
    expect(enabledTemplates[0]?.logTail).toHaveLength(2)
    expect(enabledTemplates[0]?.logTail[1]?.message).toBe('step_start · implement')

    const overlaid = service.applyAgentOverlays([
      {
        id: EXECUTOR_ID_CURSOR,
        displayName: 'Cursor (external)',
        runtime: 'external',
        role: 'custom',
        status: 'idle',
        logTail: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])
    expect(overlaid[0]?.logTail).toHaveLength(2)
  })

  it('ignores blank log messages', () => {
    const service = integrationsTestAccess(new IntegrationsService({} as never))
    service.handleAgentLog('codex', '   ')
    expect(service.applyAgentOverlays([])).toEqual([])
    expect(service.logTails.size).toBe(0)
  })
})
