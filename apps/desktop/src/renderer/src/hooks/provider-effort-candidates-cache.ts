import type { ListProviderEffortsResult } from '@planetz/shared'

const CACHE_TTL_MS = 30_000

type CacheEntry = {
  result: ListProviderEffortsResult
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<ListProviderEffortsResult>>()

function cacheKey(input: {
  provider: string
  currentEffort?: string
  workflowName?: string
}): string {
  return [input.provider, input.currentEffort ?? '', input.workflowName ?? ''].join('\0')
}

export function invalidateProviderEffortsCache(provider?: string): void {
  if (!provider) {
    cache.clear()
    inflight.clear()
    return
  }
  const prefix = `${provider}\0`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}

export function clearProviderEffortsCacheForTests(): void {
  cache.clear()
  inflight.clear()
}

export async function fetchProviderEffortsCached(input: {
  provider: string
  currentEffort?: string
  workflowName?: string
}): Promise<ListProviderEffortsResult> {
  const key = cacheKey(input)
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.result
  }

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = window.orbit
    .listProviderEfforts({
      provider: input.provider,
      currentEffort: input.currentEffort,
      workflowName: input.workflowName,
    })
    .then((result) => {
      cache.set(key, { result, fetchedAt: Date.now() })
      inflight.delete(key)
      return result
    })
    .catch((error) => {
      inflight.delete(key)
      throw error
    })

  inflight.set(key, promise)
  return promise
}
