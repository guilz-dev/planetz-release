import {
  LIVE_PROVIDER_MODELS_TTL_MS,
  type ParsedCodexModel,
  parseCodexDebugModelsOutput,
} from '@planetz/shared'
import { execa } from 'execa'

interface CodexLiveCacheEntry {
  models: ParsedCodexModel[]
  fetchedAt: string
}

let cache: CodexLiveCacheEntry | null = null

export function clearCodexLiveModelsCacheForTests(): void {
  cache = null
}

export interface CodexLiveModelsResult {
  models: ParsedCodexModel[]
  fetchedAt: string
  fromCache: boolean
  error?: string
}

/** Fetch Codex models via `codex debug models`; failures are non-fatal. */
export async function fetchCodexLiveModels(options?: {
  refresh?: boolean
}): Promise<CodexLiveModelsResult> {
  const now = Date.now()
  if (!options?.refresh && cache) {
    const age = now - Date.parse(cache.fetchedAt)
    if (age >= 0 && age < LIVE_PROVIDER_MODELS_TTL_MS) {
      return { models: cache.models, fetchedAt: cache.fetchedAt, fromCache: true }
    }
  }

  const fetchedAt = new Date().toISOString()
  try {
    const result = await execa('codex', ['debug', 'models'], {
      reject: false,
      timeout: 30_000,
    })
    if (result.exitCode !== 0) {
      const detail = (result.stderr || result.stdout || '').trim()
      return {
        models: cache?.models ?? [],
        fetchedAt: cache?.fetchedAt ?? fetchedAt,
        fromCache: Boolean(cache),
        error: detail || `codex exited with code ${result.exitCode ?? 'unknown'}`,
      }
    }
    const models = parseCodexDebugModelsOutput(result.stdout || '')
    cache = { models, fetchedAt }
    return { models, fetchedAt, fromCache: false }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      models: cache?.models ?? [],
      fetchedAt: cache?.fetchedAt ?? fetchedAt,
      fromCache: Boolean(cache),
      error: message,
    }
  }
}

export function isCodexLiveCacheStale(fetchedAt: string | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return true
  const age = now - Date.parse(fetchedAt)
  return age < 0 || age >= LIVE_PROVIDER_MODELS_TTL_MS
}
