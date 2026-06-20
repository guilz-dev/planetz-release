import type { ListProviderModelsResult, ProviderModelCandidate } from '@planetz/shared'

/** Reuse merged model lists across Advanced opens; invalidate on config/history changes. */
const PROVIDER_MODEL_CANDIDATES_CACHE_TTL_MS = 300_000

interface CacheEntry {
  result: ListProviderModelsResult
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<ListProviderModelsResult>>()

export interface FetchProviderModelsInput {
  provider: string
  workflowName?: string
  refresh?: boolean
}

function cacheKey(input: FetchProviderModelsInput): string {
  return `${input.provider.trim()}|${input.workflowName?.trim() ?? ''}|${input.refresh ? '1' : '0'}`
}

/** Per-field saved tier overlay; base list is cached without currentModel. */
export function withSavedModelCandidate(
  models: ProviderModelCandidate[],
  currentModel?: string,
): ProviderModelCandidate[] {
  const id = currentModel?.trim()
  if (!id || models.some((candidate) => candidate.id === id)) return models
  return [...models, { id, source: 'saved' }]
}

export async function fetchProviderModelsCached(
  input: FetchProviderModelsInput,
): Promise<ListProviderModelsResult> {
  const trimmedProvider = input.provider.trim()
  if (!trimmedProvider) return { models: [] }

  const key = cacheKey(input)
  if (!input.refresh) {
    const hit = cache.get(key)
    if (hit && Date.now() < hit.expiresAt) return hit.result
  }

  let pending = inflight.get(key)
  if (!pending) {
    pending = window.orbit
      .listProviderModels({
        provider: trimmedProvider,
        workflowName: input.workflowName?.trim() || undefined,
        refresh: input.refresh,
      })
      .finally(() => {
        inflight.delete(key)
      })
    inflight.set(key, pending)
  }

  const result = await pending
  const cacheTargetKey = `${trimmedProvider}|${input.workflowName?.trim() ?? ''}|0`
  cache.set(cacheTargetKey, {
    result,
    expiresAt: Date.now() + PROVIDER_MODEL_CANDIDATES_CACHE_TTL_MS,
  })
  return result
}

export function invalidateProviderModelsCache(provider?: string): void {
  if (!provider?.trim()) {
    cache.clear()
    inflight.clear()
    return
  }
  const prefix = `${provider.trim()}|`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}

export function clearProviderModelsCacheForTests(): void {
  cache.clear()
  inflight.clear()
}
