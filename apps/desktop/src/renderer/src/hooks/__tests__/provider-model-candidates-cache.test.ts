import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearProviderModelsCacheForTests,
  fetchProviderModelsCached,
  invalidateProviderModelsCache,
  withSavedModelCandidate,
} from '../provider-model-candidates-cache.js'

describe('provider-model-candidates-cache', () => {
  afterEach(() => {
    clearProviderModelsCacheForTests()
    vi.restoreAllMocks()
  })

  it('dedupes concurrent requests for the same provider', async () => {
    const listProviderModels = vi.fn(async () => ({
      models: [{ id: 'auto', source: 'live' as const }],
    }))
    vi.stubGlobal('window', { orbit: { listProviderModels } })

    const [a, b] = await Promise.all([
      fetchProviderModelsCached({ provider: 'cursor' }),
      fetchProviderModelsCached({ provider: 'cursor' }),
    ])

    expect(listProviderModels).toHaveBeenCalledTimes(1)
    expect(a.models).toEqual(b.models)
  })

  it('invalidates cache entries for a provider after history delete flow', async () => {
    const listProviderModels = vi
      .fn()
      .mockResolvedValueOnce({ models: [{ id: 'a', source: 'history' as const }] })
      .mockResolvedValueOnce({ models: [] })
    vi.stubGlobal('window', { orbit: { listProviderModels } })

    await fetchProviderModelsCached({ provider: 'cursor' })
    invalidateProviderModelsCache('cursor')
    const next = await fetchProviderModelsCached({ provider: 'cursor' })

    expect(listProviderModels).toHaveBeenCalledTimes(2)
    expect(next.models).toEqual([])
  })

  it('drops inflight entries for a provider on invalidate', async () => {
    let resolveFirst: ((value: { models: { id: string; source: 'live' }[] }) => void) | null = null
    const firstPending = new Promise<{ models: { id: string; source: 'live' }[] }>((resolve) => {
      resolveFirst = resolve
    })
    const listProviderModels = vi
      .fn()
      .mockImplementationOnce(async () => firstPending)
      .mockResolvedValueOnce({ models: [{ id: 'fresh', source: 'live' as const }] })
    vi.stubGlobal('window', { orbit: { listProviderModels } })

    const first = fetchProviderModelsCached({ provider: 'cursor' })
    invalidateProviderModelsCache('cursor')
    const second = fetchProviderModelsCached({ provider: 'cursor' })

    expect(listProviderModels).toHaveBeenCalledTimes(2)
    resolveFirst!({ models: [{ id: 'stale', source: 'live' }] })

    await first
    const refreshed = await second
    expect(refreshed.models).toEqual([{ id: 'fresh', source: 'live' }])
  })

  it('appends current model as saved tier without affecting cache key', () => {
    const merged = withSavedModelCandidate([{ id: 'auto', source: 'live' }], 'custom-model')
    expect(merged).toEqual([
      { id: 'auto', source: 'live' },
      { id: 'custom-model', source: 'saved' },
    ])
    expect(withSavedModelCandidate(merged, 'custom-model')).toEqual(merged)
  })
})
