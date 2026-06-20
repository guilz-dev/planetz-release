import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWorkspaceExecutionCatalog } from '../planetz/execution-catalog-service.js'

const { fetchCursorLiveModelsMock, fetchCopilotLiveModelsMock, detectRuntimeProviderIdsMock } =
  vi.hoisted(() => ({
    fetchCursorLiveModelsMock: vi.fn(),
    fetchCopilotLiveModelsMock: vi.fn(),
    detectRuntimeProviderIdsMock: vi.fn<() => Promise<string[]>>(async () => []),
  }))

vi.mock('../planetz/cursor-model-discovery.js', () => ({
  fetchCursorLiveModels: (...args: unknown[]) => fetchCursorLiveModelsMock(...args),
  clearCursorLiveModelsCacheForTests: vi.fn(),
}))

vi.mock('../planetz/copilot-model-discovery.js', () => ({
  fetchCopilotLiveModels: (...args: unknown[]) => fetchCopilotLiveModelsMock(...args),
  clearCopilotLiveModelsCacheForTests: vi.fn(),
}))

vi.mock('../planetz/provider-runtime-detection.js', () => ({
  detectRuntimeProviderIds: detectRuntimeProviderIdsMock,
}))

describe('loadWorkspaceExecutionCatalog', () => {
  let workspacePath: string
  let planetzWorkflowsDir: string
  const originalFetch = globalThis.fetch

  beforeEach(async () => {
    fetchCursorLiveModelsMock.mockReset()
    fetchCopilotLiveModelsMock.mockReset()
    detectRuntimeProviderIdsMock.mockReset()
    detectRuntimeProviderIdsMock.mockResolvedValue([])
    fetchCopilotLiveModelsMock.mockResolvedValue({
      models: [],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      error: 'copilot unavailable',
    })
    fetchCursorLiveModelsMock.mockResolvedValue({
      models: [],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      error: 'cursor-agent unavailable',
    })
    workspacePath = await mkdtemp(join(tmpdir(), 'planetz-catalog-'))
    planetzWorkflowsDir = join(workspacePath, '.orbit', 'workflows')
    await mkdir(planetzWorkflowsDir, { recursive: true })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('adds cursor live models without mutating runtimeDetectedProviders', async () => {
    fetchCursorLiveModelsMock.mockResolvedValue({
      models: [{ id: 'composer-2.5', label: 'Composer 2.5' }],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    })

    const catalog = await loadWorkspaceExecutionCatalog({
      engineConfig: {},
      planetzWorkflowsDir,
      workspacePath,
      config: DEFAULT_CONFIG,
    })

    expect(catalog.configuredProviders).toEqual([])
    expect(catalog.runtimeDetectedProviders).toEqual([])
    expect(catalog.modelsByProvider.cursor).toContain('composer-2.5')
    expect(fetchCursorLiveModelsMock).toHaveBeenCalled()
  })

  it('leaves catalog unchanged when cursor-agent is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch
    fetchCursorLiveModelsMock.mockResolvedValue({
      models: [],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      error: 'cursor-agent not found',
    })

    const catalog = await loadWorkspaceExecutionCatalog({
      engineConfig: {},
      planetzWorkflowsDir,
      workspacePath,
      config: DEFAULT_CONFIG,
    })

    expect(catalog.configuredProviders).toEqual([])
    expect(catalog.runtimeDetectedProviders).toEqual([])
  })

  it('adds ollama live models without mutating runtimeDetectedProviders', async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        models: [{ name: 'llama3.2:latest', details: { parameter_size: '3B' } }],
      }),
    ) as typeof fetch

    const catalog = await loadWorkspaceExecutionCatalog({
      engineConfig: { provider: 'cursor', model: 'auto' },
      planetzWorkflowsDir,
      workspacePath,
      config: DEFAULT_CONFIG,
    })

    expect(catalog.configuredProviders).toEqual(['cursor'])
    expect(catalog.runtimeDetectedProviders).toEqual([])
    expect(catalog.modelsByProvider.ollama).toContain('llama3.2:latest')
  })

  it('leaves catalog unchanged when Ollama is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch

    const catalog = await loadWorkspaceExecutionCatalog({
      engineConfig: { provider: 'cursor', model: 'auto' },
      planetzWorkflowsDir,
      workspacePath,
      config: DEFAULT_CONFIG,
    })

    expect(catalog.configuredProviders).toEqual(['cursor'])
    expect(catalog.runtimeDetectedProviders).toEqual([])
  })

  it('includes ollama from engine provider_options without a live probe', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch

    const catalog = await loadWorkspaceExecutionCatalog({
      engineConfig: {
        provider: 'cursor',
        provider_options: { ollama: { base_url: 'http://127.0.0.1:11434' } },
      },
      planetzWorkflowsDir,
      workspacePath,
      config: DEFAULT_CONFIG,
    })

    expect(catalog.configuredProviders).toContain('ollama')
    expect(catalog.configuredProviders).toContain('cursor')
    expect(catalog.runtimeDetectedProviders).toEqual([])
  })

  it('adds runtime-detected providers without changing configuredProviders', async () => {
    detectRuntimeProviderIdsMock.mockResolvedValue(['claude', 'codex'])

    const catalog = await loadWorkspaceExecutionCatalog({
      engineConfig: {},
      planetzWorkflowsDir,
      workspacePath,
      config: DEFAULT_CONFIG,
    })

    expect(catalog.configuredProviders).toEqual([])
    expect(catalog.runtimeDetectedProviders).toContain('claude')
    expect(catalog.runtimeDetectedProviders).toContain('codex')
  })
})
