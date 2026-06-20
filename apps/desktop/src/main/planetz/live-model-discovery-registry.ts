import type { OrbitProviderId } from '@planetz/shared'
import {
  type CodexLiveModelsResult,
  fetchCodexLiveModels,
  isCodexLiveCacheStale,
} from './codex-model-discovery.js'
import {
  type CopilotLiveModelsResult,
  fetchCopilotLiveModels,
  isCopilotLiveCacheStale,
} from './copilot-model-discovery.js'
import {
  type CursorLiveModelsResult,
  fetchCursorLiveModels,
  isCursorLiveCacheStale,
} from './cursor-model-discovery.js'

export type CliLiveModelsResult =
  | CursorLiveModelsResult
  | CodexLiveModelsResult
  | CopilotLiveModelsResult

export interface LiveModelFetcher {
  fetch: (options?: { refresh?: boolean }) => Promise<CliLiveModelsResult>
  isStale: (fetchedAt: string | undefined) => boolean
}

export const CLI_LIVE_MODEL_FETCHERS: Partial<Record<OrbitProviderId, LiveModelFetcher>> = {
  cursor: { fetch: fetchCursorLiveModels, isStale: isCursorLiveCacheStale },
  codex: { fetch: fetchCodexLiveModels, isStale: isCodexLiveCacheStale },
  copilot: { fetch: fetchCopilotLiveModels, isStale: isCopilotLiveCacheStale },
}

export function getCliLiveModelFetcher(provider: string): LiveModelFetcher | undefined {
  const id = provider.trim()
  if (!id) return undefined
  return CLI_LIVE_MODEL_FETCHERS[id as OrbitProviderId]
}
