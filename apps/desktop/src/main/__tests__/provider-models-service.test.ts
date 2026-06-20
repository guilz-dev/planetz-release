import type { ExecutionCatalog, ModelHistoryItem } from '@planetz/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderModelsService } from '../planetz/provider-models-service.js'
import type { ModelHistoryStore } from '../sidecar/model-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

const mocks = vi.hoisted(() => ({
  fetchCursorLiveModels: vi.fn(),
  fetchCodexLiveModels: vi.fn(),
  fetchCopilotLiveModels: vi.fn(),
}))

vi.mock('../planetz/cursor-model-discovery.js', () => ({
  fetchCursorLiveModels: mocks.fetchCursorLiveModels,
  isCursorLiveCacheStale: vi.fn(() => false),
}))

vi.mock('../planetz/codex-model-discovery.js', () => ({
  fetchCodexLiveModels: mocks.fetchCodexLiveModels,
  isCodexLiveCacheStale: vi.fn(() => false),
}))

vi.mock('../planetz/copilot-model-discovery.js', () => ({
  fetchCopilotLiveModels: mocks.fetchCopilotLiveModels,
  isCopilotLiveCacheStale: vi.fn(() => false),
}))

vi.mock('../planetz/local-llm/local-llm-service.js', () => ({
  getDefaultLocalLlmService: () => ({
    getAdapter: () => null,
    listLiveModels: vi.fn(),
  }),
}))

function catalogFor(provider: string, models: string[]): ExecutionCatalog {
  return {
    configuredProviders: [provider],
    runtimeDetectedProviders: [],
    modelsByProvider: { [provider]: models },
    effortsByProvider: {},
  }
}

describe('ProviderModelsService', () => {
  beforeEach(() => {
    mocks.fetchCursorLiveModels.mockReset()
    mocks.fetchCodexLiveModels.mockReset()
    mocks.fetchCopilotLiveModels.mockReset()
  })

  it('filters invalid cursor model ids from live/history/workspace/saved tiers', async () => {
    mocks.fetchCursorLiveModels.mockResolvedValue({
      models: [{ id: 'auto', label: 'Auto' }, { id: 'Available' }],
      fetchedAt: '2026-06-01T00:00:00.000Z',
      fromCache: false,
    })
    const history: ModelHistoryItem[] = [
      {
        provider: 'cursor',
        model: 'Available',
        lastUsedAt: '2026-06-01T00:00:00.000Z',
        useCount: 1,
      },
      { provider: 'cursor', model: 'auto', lastUsedAt: '2026-06-01T00:00:00.000Z', useCount: 1 },
    ]
    const modelHistoryStore = {
      list: vi.fn(async () => history),
    } as unknown as ModelHistoryStore
    const service = new ProviderModelsService(modelHistoryStore)

    const result = await service.listProviderModels({
      paths: { root: '/tmp' } as SidecarPaths,
      provider: 'cursor',
      catalog: catalogFor('cursor', ['Available', 'auto']),
      engineConfig: { provider: 'cursor', model: 'Available' },
      currentModel: 'Available',
      lastSelectedModel: 'Available',
    })

    const ids = result.models.map((model) => model.id)
    expect(ids).toContain('auto')
    expect(ids).not.toContain('Available')
    expect(result.lastSelectedModel).toBeUndefined()
  })

  it('lists codex live models from codex debug models', async () => {
    mocks.fetchCodexLiveModels.mockResolvedValue({
      models: [{ id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' }],
      fetchedAt: '2026-06-01T00:00:00.000Z',
      fromCache: false,
    })
    const modelHistoryStore = {
      list: vi.fn(async () => []),
    } as unknown as ModelHistoryStore
    const service = new ProviderModelsService(modelHistoryStore)

    const result = await service.listProviderModels({
      paths: { root: '/tmp' } as SidecarPaths,
      provider: 'codex',
      catalog: catalogFor('codex', []),
      engineConfig: { provider: 'codex' },
      lastSelectedModel: 'gpt-5.3-codex',
    })

    expect(result.models.map((model) => model.id)).toContain('gpt-5.3-codex')
    expect(result.lastSelectedModel).toBe('gpt-5.3-codex')
    expect(mocks.fetchCodexLiveModels).toHaveBeenCalledOnce()
  })

  it('lists copilot live models from copilot sdk discovery', async () => {
    mocks.fetchCopilotLiveModels.mockResolvedValue({
      models: [{ id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' }],
      fetchedAt: '2026-06-01T00:00:00.000Z',
      fromCache: false,
    })
    const modelHistoryStore = {
      list: vi.fn(async () => []),
    } as unknown as ModelHistoryStore
    const service = new ProviderModelsService(modelHistoryStore)

    const result = await service.listProviderModels({
      paths: { root: '/tmp' } as SidecarPaths,
      provider: 'copilot',
      catalog: catalogFor('copilot', []),
      engineConfig: { provider: 'copilot' },
    })

    expect(result.models.map((model) => model.id)).toContain('gpt-5.3-codex')
    expect(mocks.fetchCopilotLiveModels).toHaveBeenCalledOnce()
  })
})
