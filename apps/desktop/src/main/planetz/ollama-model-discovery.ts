import {
  classifyOllamaError,
  type EngineConfig,
  LIVE_PROVIDER_MODELS_TTL_MS,
  OLLAMA_TAGS_FETCH_TIMEOUT_MS,
  type OllamaErrorCode,
  type ParsedOllamaModel,
  parseOllamaTagsResponse,
  resolveOllamaFetchOrigin,
} from '@planetz/shared'

interface OllamaLiveCacheEntry {
  models: ParsedOllamaModel[]
  fetchedAt: string
  origin: string
}

let cache: OllamaLiveCacheEntry | null = null

/** Drop cached `/api/tags` results (e.g. after pull/delete). */
export function invalidateOllamaLiveModelsCache(): void {
  cache = null
}

export function clearOllamaLiveModelsCacheForTests(): void {
  invalidateOllamaLiveModelsCache()
}

export interface OllamaLiveModelsResult {
  models: ParsedOllamaModel[]
  fetchedAt: string
  fromCache: boolean
  error?: string
  errorCode?: OllamaErrorCode
}

/** Fetch Ollama models via `GET /api/tags`; failures are non-fatal. */
export async function fetchOllamaLiveModels(options?: {
  refresh?: boolean
  engineConfig?: EngineConfig | null
}): Promise<OllamaLiveModelsResult> {
  const origin = resolveOllamaFetchOrigin(options?.engineConfig)
  const now = Date.now()
  if (!options?.refresh && cache && cache.origin === origin) {
    const age = now - Date.parse(cache.fetchedAt)
    if (age >= 0 && age < LIVE_PROVIDER_MODELS_TTL_MS) {
      return { models: cache.models, fetchedAt: cache.fetchedAt, fromCache: true }
    }
  }

  const fetchedAt = new Date().toISOString()
  try {
    const response = await fetch(`${origin}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_TAGS_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      const detail = (await response.text()).trim()
      const message = detail || `Ollama tags request failed with status ${response.status}`
      const { code } = classifyOllamaError({ message, status: response.status })
      return {
        models: cache?.origin === origin ? cache.models : [],
        fetchedAt: cache?.origin === origin ? cache.fetchedAt : fetchedAt,
        fromCache: Boolean(cache?.origin === origin && cache),
        error: message,
        errorCode: code,
      }
    }
    const json: unknown = await response.json()
    const models = parseOllamaTagsResponse(json)
    cache = { models, fetchedAt, origin }
    return { models, fetchedAt, fromCache: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const { code } = classifyOllamaError({ message, cause: error })
    return {
      models: cache?.origin === origin ? cache.models : [],
      fetchedAt: cache?.origin === origin ? cache.fetchedAt : fetchedAt,
      fromCache: Boolean(cache?.origin === origin && cache),
      error: message,
      errorCode: code,
    }
  }
}

export function isOllamaLiveCacheStale(fetchedAt: string | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return true
  const age = now - Date.parse(fetchedAt)
  return age < 0 || age >= LIVE_PROVIDER_MODELS_TTL_MS
}
