import { LIVE_PROVIDER_MODELS_TTL_MS } from './constants.js'
import type { EngineConfig } from './engine-config-schema.js'

/** Default Ollama HTTP origin when none is configured. */
export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434'

/** @deprecated Use {@link LIVE_PROVIDER_MODELS_TTL_MS}. */
export const OLLAMA_LIVE_MODELS_TTL_MS = LIVE_PROVIDER_MODELS_TTL_MS

/** LLM timeout for Ollama-backed composer/title calls (cold model load). */
export const OLLAMA_LLM_TIMEOUT_MS = 120_000

/** Timeout for `GET /api/tags` live model discovery. */
export const OLLAMA_TAGS_FETCH_TIMEOUT_MS = 30_000

/** Timeout for `POST /api/pull` (model download). */
export const OLLAMA_PULL_FETCH_TIMEOUT_MS = 600_000

/** Timeout for `DELETE /api/delete`. */
export const OLLAMA_DELETE_FETCH_TIMEOUT_MS = 60_000

const OLLAMA_PROVIDER_OPTIONS_KEY = 'ollama'

function engineProviderOptions(engine: EngineConfig): Record<string, unknown> | undefined {
  const raw = (engine as Record<string, unknown>).provider_options
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function ollamaBucket(
  providerOptions: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const bucket = providerOptions?.[OLLAMA_PROVIDER_OPTIONS_KEY]
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return undefined
  return bucket as Record<string, unknown>
}

/** True when engine config targets Ollama (explicit provider or ollama base URL). */
export function isOllamaEngineConfigured(engine: EngineConfig | null | undefined): boolean {
  if (!engine) return false
  if (engine.provider?.trim() === 'ollama') return true
  return readOllamaBaseUrl(engine) !== undefined
}

/** Normalized fetch origin from engine config (tags, pull, delete). */
export function resolveOllamaFetchOrigin(engine?: EngineConfig | null): string {
  return normalizeOllamaOriginForFetch(readOllamaBaseUrl(engine ?? {}))
}

/** Read configured Ollama base URL from engine `provider_options.ollama.base_url`. */
export function readOllamaBaseUrl(engine: EngineConfig): string | undefined {
  const url = ollamaBucket(engineProviderOptions(engine))?.base_url
  if (typeof url !== 'string') return undefined
  const trimmed = url.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Merge `base_url` into engine `provider_options.ollama` without dropping sibling keys. */
export function writeOllamaBaseUrl(
  engine: EngineConfig,
  baseUrl: string | undefined,
): EngineConfig {
  const next = { ...engine } as EngineConfig & { provider_options?: Record<string, unknown> }
  const existing = engineProviderOptions(engine) ?? {}
  const ollamaExisting = ollamaBucket(existing) ?? {}
  const trimmed = baseUrl?.trim()

  if (!trimmed) {
    const { base_url: _removed, ...restOllama } = ollamaExisting
    const { [OLLAMA_PROVIDER_OPTIONS_KEY]: _ollama, ...restOptions } = existing
    if (Object.keys(restOllama).length > 0) {
      next.provider_options = { ...restOptions, [OLLAMA_PROVIDER_OPTIONS_KEY]: restOllama }
    } else if (Object.keys(restOptions).length > 0) {
      next.provider_options = restOptions
    } else {
      delete next.provider_options
    }
    return next
  }

  next.provider_options = {
    ...existing,
    [OLLAMA_PROVIDER_OPTIONS_KEY]: { ...ollamaExisting, base_url: trimmed },
  }
  return next
}

/** Normalize user input to an HTTP(S) origin for `fetch` (no trailing slash). */
export function normalizeOllamaOriginForFetch(input?: string): string {
  const raw = input?.trim() || OLLAMA_DEFAULT_BASE_URL
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`
  try {
    const url = new URL(withScheme)
    return `${url.protocol}//${url.host}`
  } catch {
    return OLLAMA_DEFAULT_BASE_URL.replace(/\/$/, '')
  }
}

function defaultOllamaHostPort(): string {
  try {
    const url = new URL(OLLAMA_DEFAULT_BASE_URL)
    return url.port ? `${url.hostname}:${url.port}` : url.hostname
  } catch {
    return '127.0.0.1:11434'
  }
}

/** Value for `OLLAMA_HOST` passed to the Ollama runtime and bundled orbit provider. */
export function normalizeOllamaHostForEnv(input?: string): string {
  const origin = normalizeOllamaOriginForFetch(input)
  try {
    const url = new URL(origin)
    if (url.port) {
      return `${url.hostname}:${url.port}`
    }
    const defaultPort = new URL(OLLAMA_DEFAULT_BASE_URL).port
    if (defaultPort) {
      return `${url.hostname}:${defaultPort}`
    }
    return url.hostname
  } catch {
    return defaultOllamaHostPort()
  }
}

/** True when the normalized Ollama origin is loopback-only (safe for destructive admin). */
export function isOllamaLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(normalizeOllamaOriginForFetch(origin))
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    return host === '127.0.0.1' || host === 'localhost' || host === '::1'
  } catch {
    return false
  }
}

/** Overlay unsaved engine form state onto persisted config (e.g. live model probe). */
export function mergeEngineConfigPreview(
  effective: EngineConfig,
  preview: EngineConfig | undefined,
): EngineConfig {
  if (!preview) return effective
  return {
    ...effective,
    ...preview,
    ...(preview.provider_options !== undefined
      ? { provider_options: preview.provider_options }
      : {}),
  }
}
