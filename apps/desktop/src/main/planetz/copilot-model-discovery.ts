import {
  filterCopilotListModels,
  LIVE_PROVIDER_MODEL_FETCH_TIMEOUT_MS,
  LIVE_PROVIDER_MODELS_TTL_MS,
  type ParsedCopilotModel,
} from '@planetz/shared'
import { isGitHubCopilotCliAvailable } from './copilot-cli-readiness.js'

interface CopilotLiveCacheEntry {
  models: ParsedCopilotModel[]
  fetchedAt: string
}

let cache: CopilotLiveCacheEntry | null = null

export function clearCopilotLiveModelsCacheForTests(): void {
  cache = null
}

export interface CopilotLiveModelsResult {
  models: ParsedCopilotModel[]
  fetchedAt: string
  fromCache: boolean
  error?: string
}

function isCopilotByokConfigured(): boolean {
  const baseUrl = process.env.COPILOT_PROVIDER_BASE_URL?.trim()
  return baseUrl != null && baseUrl.length > 0
}

function byokDisabledResult(fetchedAt: string): CopilotLiveModelsResult {
  return {
    models: [],
    fetchedAt,
    fromCache: false,
    error:
      'Copilot live model listing is unavailable when a custom provider base URL is configured',
  }
}

function cachedOrError(fetchedAt: string, error: string): CopilotLiveModelsResult {
  return {
    models: cache?.models ?? [],
    fetchedAt: cache?.fetchedAt ?? fetchedAt,
    fromCache: Boolean(cache),
    error,
  }
}

/** Fetch Copilot models via `@github/copilot-sdk` (`models.list`); failures are non-fatal. */
export async function fetchCopilotLiveModels(options?: {
  refresh?: boolean
  timeoutMs?: number
}): Promise<CopilotLiveModelsResult> {
  const fetchedAt = new Date().toISOString()

  if (isCopilotByokConfigured()) {
    return byokDisabledResult(fetchedAt)
  }

  const now = Date.now()
  if (!options?.refresh && cache) {
    const age = now - Date.parse(cache.fetchedAt)
    if (age >= 0 && age < LIVE_PROVIDER_MODELS_TTL_MS) {
      return { models: cache.models, fetchedAt: cache.fetchedAt, fromCache: true }
    }
  }

  if (!(await isGitHubCopilotCliAvailable())) {
    return cachedOrError(fetchedAt, 'GitHub Copilot CLI not found')
  }

  try {
    const timeoutMs = options?.timeoutMs ?? LIVE_PROVIDER_MODEL_FETCH_TIMEOUT_MS
    const models = await fetchCopilotModelsFromSdk(timeoutMs)
    cache = { models, fetchedAt }
    return { models, fetchedAt, fromCache: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return cachedOrError(fetchedAt, message)
  }
}

async function fetchCopilotModelsFromSdk(timeoutMs: number): Promise<ParsedCopilotModel[]> {
  const { CopilotClient } = await import('@github/copilot-sdk')
  const client = new CopilotClient()
  let timer: ReturnType<typeof setTimeout> | undefined
  let timeoutTriggered = false
  const stopClient = async () => {
    await client.stop().catch(() => {})
  }
  try {
    await client.start()
    const modelsPromise = client.listModels()
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timeoutTriggered = true
        void stopClient()
        reject(new Error('Copilot model discovery timed out'))
      }, timeoutMs)
    })
    const models = (await Promise.race([modelsPromise, timeoutPromise])) as Parameters<
      typeof filterCopilotListModels
    >[0]
    return filterCopilotListModels(models)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (!timeoutTriggered) {
      await stopClient()
    }
  }
}

export function isCopilotLiveCacheStale(fetchedAt: string | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return true
  const age = now - Date.parse(fetchedAt)
  return age < 0 || age >= LIVE_PROVIDER_MODELS_TTL_MS
}
