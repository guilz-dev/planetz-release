import type { OllamaErrorCode } from '@planetz/shared'
import type { OllamaLiveModelsResult } from './ollama-model-discovery.js'

export type OllamaHealthStatus = 'healthy' | 'degraded' | 'unreachable'

export interface OllamaHealthSnapshot {
  status: OllamaHealthStatus
  lastCheckedAt: string
  latencyMs?: number
  liveErrorCode?: OllamaErrorCode
  modelCount?: number
}

/** Map a live tags fetch result into a health snapshot for IPC and the monitor. */
export function buildOllamaHealthSnapshot(
  result: OllamaLiveModelsResult,
  latencyMs: number,
  lastCheckedAt = new Date().toISOString(),
): OllamaHealthSnapshot {
  let status: OllamaHealthStatus
  if (result.error) {
    status = result.fromCache && result.models.length > 0 ? 'degraded' : 'unreachable'
  } else {
    status = 'healthy'
  }
  return {
    status,
    lastCheckedAt,
    latencyMs,
    ...(result.errorCode ? { liveErrorCode: result.errorCode } : {}),
    modelCount: result.models.length,
  }
}
