import type { OllamaErrorCode } from './ollama-errors.js'

/** Source tier for provider/model candidate display (merge order: live → history → workspace → suggested → saved). */
export const MODEL_CANDIDATE_SOURCES = [
  'live',
  'history',
  'workspace',
  'suggested',
  'saved',
] as const

export type ModelCandidateSource = (typeof MODEL_CANDIDATE_SOURCES)[number]

export interface ProviderModelCandidate {
  id: string
  label?: string
  source: ModelCandidateSource
}

export interface ModelHistoryItem {
  provider: string
  model: string
  lastUsedAt: string
  useCount: number
}

export interface ListProviderModelsResult {
  models: ProviderModelCandidate[]
  lastSelectedModel?: string
  fetchedAt?: string
  stale?: boolean
  liveError?: string
  liveErrorCode?: OllamaErrorCode
}
