import type { ListProviderModelsResult, ProviderModelCandidate } from './model-candidate-types.js'
import type { OrbitProviderId } from './orbit-provider-catalog.js'

/** Providers whose models can be listed from a live connection (matches main-side discovery). */
export const LIVE_MODEL_LISTING_ORBIT_PROVIDER_IDS = [
  'cursor',
  'codex',
  'ollama',
  'copilot',
] as const satisfies readonly OrbitProviderId[]

const LIVE_MODEL_LISTING_PROVIDER_SET = new Set<string>(LIVE_MODEL_LISTING_ORBIT_PROVIDER_IDS)

export type ModelFieldMode = 'select' | 'input'

export function providerSupportsLiveModelListing(provider: string | undefined): boolean {
  const id = provider?.trim()
  return id != null && id.length > 0 && LIVE_MODEL_LISTING_PROVIDER_SET.has(id)
}

export function isLiveProviderModelsSuccess(
  result: Pick<ListProviderModelsResult, 'fetchedAt' | 'liveError'>,
): boolean {
  return Boolean(result.fetchedAt) && !result.liveError
}

export function hasLiveModelCandidates(candidates: readonly ProviderModelCandidate[]): boolean {
  return candidates.some((candidate) => candidate.source === 'live')
}

/** When live listing succeeded with models, restrict the field to known candidates. */
export function shouldRestrictModelToCandidates(input: {
  fetchedAt?: string
  liveError?: string
  loading: boolean
  candidates: readonly ProviderModelCandidate[]
}): boolean {
  if (input.loading || !isLiveProviderModelsSuccess(input)) return false
  return hasLiveModelCandidates(input.candidates)
}

/** Select while loading live-capable providers avoids Input→Select flicker after fetch. */
export function resolveModelFieldMode(input: {
  provider: string
  fetchedAt?: string
  liveError?: string
  loading: boolean
  candidates: readonly ProviderModelCandidate[]
}): ModelFieldMode {
  if (shouldRestrictModelToCandidates(input)) return 'select'
  if (input.loading && providerSupportsLiveModelListing(input.provider)) return 'select'
  return 'input'
}
