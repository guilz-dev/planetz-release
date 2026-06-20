import {
  CURSOR_LIVE_MODELS_TTL_MS,
  type ParsedCursorModel,
  parseCursorListModelsOutput,
} from '@planetz/shared'
import { execa } from 'execa'

interface CursorLiveCacheEntry {
  models: ParsedCursorModel[]
  fetchedAt: string
}

let cache: CursorLiveCacheEntry | null = null

export function clearCursorLiveModelsCacheForTests(): void {
  cache = null
}

export interface CursorLiveModelsResult {
  models: ParsedCursorModel[]
  fetchedAt: string
  fromCache: boolean
  error?: string
}

/** Fetch Cursor models via `cursor-agent --list-models`; failures are non-fatal. */
export async function fetchCursorLiveModels(options?: {
  refresh?: boolean
}): Promise<CursorLiveModelsResult> {
  const now = Date.now()
  if (!options?.refresh && cache) {
    const age = now - Date.parse(cache.fetchedAt)
    if (age >= 0 && age < CURSOR_LIVE_MODELS_TTL_MS) {
      return { models: cache.models, fetchedAt: cache.fetchedAt, fromCache: true }
    }
  }

  const fetchedAt = new Date().toISOString()
  try {
    const result = await execa('cursor-agent', ['--list-models'], {
      reject: false,
      timeout: 30_000,
    })
    if (result.exitCode !== 0) {
      const detail = (result.stderr || result.stdout || '').trim()
      return {
        models: cache?.models ?? [],
        fetchedAt: cache?.fetchedAt ?? fetchedAt,
        fromCache: Boolean(cache),
        error: detail || `cursor-agent exited with code ${result.exitCode ?? 'unknown'}`,
      }
    }
    const models = parseCursorListModelsOutput(result.stdout || '')
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

export function isCursorLiveCacheStale(fetchedAt: string | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return true
  const age = now - Date.parse(fetchedAt)
  return age < 0 || age >= CURSOR_LIVE_MODELS_TTL_MS
}
