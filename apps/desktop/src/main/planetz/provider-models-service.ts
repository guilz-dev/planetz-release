import {
  catalogModelOptions,
  collectProviderScopedSavedModelIds,
  type EngineConfig,
  type ExecutionCatalog,
  type ExecutionProfileOverrides,
  isCursorModelId,
  type ListProviderModelsResult,
  mergeProviderModelCandidates,
  modelHintsForOrbitProvider,
} from '@planetz/shared'
import type { ModelHistoryStore } from '../sidecar/model-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { getCliLiveModelFetcher } from './live-model-discovery-registry.js'
import { getDefaultLocalLlmService } from './local-llm/local-llm-service.js'
import { isOllamaLiveCacheStale } from './ollama-model-discovery.js'

export interface ListProviderModelsContext {
  paths: SidecarPaths
  provider: string
  catalog: ExecutionCatalog
  engineConfig?: EngineConfig | null
  workflowDefaults?: ExecutionProfileOverrides
  currentModel?: string
  lastSelectedModel?: string
  refresh?: boolean
}

async function fetchLiveModelsForProvider(
  provider: string,
  ctx: ListProviderModelsContext,
): Promise<
  | {
      models: Array<{ id: string; label?: string }>
      fetchedAt: string
      stale: boolean
      error?: string
      errorCode?: ListProviderModelsResult['liveErrorCode']
    }
  | undefined
> {
  const cliFetcher = getCliLiveModelFetcher(provider)
  if (cliFetcher) {
    const liveResult = await cliFetcher.fetch({ refresh: ctx.refresh })
    return {
      models: liveResult.models,
      fetchedAt: liveResult.fetchedAt,
      stale: cliFetcher.isStale(liveResult.fetchedAt),
      error: liveResult.error,
    }
  }

  const localLlmService = getDefaultLocalLlmService()
  const localLlm = localLlmService.getAdapter(provider)
  if (localLlm) {
    const engine = ctx.engineConfig ?? {}
    const liveResult = await localLlmService.listLiveModels(
      localLlm.id,
      engine,
      ctx.refresh ?? false,
    )
    return {
      models: liveResult.models,
      fetchedAt: liveResult.fetchedAt,
      stale: isOllamaLiveCacheStale(liveResult.fetchedAt),
      error: liveResult.error,
      errorCode: liveResult.errorCode,
    }
  }
  return undefined
}

export class ProviderModelsService {
  constructor(private readonly modelHistoryStore: ModelHistoryStore) {}

  async listProviderModels(ctx: ListProviderModelsContext): Promise<ListProviderModelsResult> {
    const provider = ctx.provider.trim()
    const sanitizeCursorIds = (ids: string[]): string[] =>
      provider === 'cursor' ? ids.filter(isCursorModelId) : ids
    const sanitizeCursorLiveIds = (
      items: Array<{ id: string; label?: string }> | undefined,
    ): Array<{ id: string; label?: string }> | undefined =>
      provider === 'cursor' ? items?.filter((item) => isCursorModelId(item.id)) : items
    const lastSelectedModel = sanitizeCursorIds(
      ctx.lastSelectedModel?.trim() ? [ctx.lastSelectedModel.trim()] : [],
    )[0]

    const historyItems = await this.modelHistoryStore.list(ctx.paths, provider)
    const history = sanitizeCursorIds(historyItems.map((item) => item.model))

    const workspace = sanitizeCursorIds(catalogModelOptions(provider, ctx.catalog, []))
    const suggested = sanitizeCursorIds([...modelHintsForOrbitProvider(provider)])
    const saved = sanitizeCursorIds(
      collectProviderScopedSavedModelIds({
        provider,
        currentModel: ctx.currentModel,
        lastSelectedModel,
        engineConfig: ctx.engineConfig,
        workflowDefaults: ctx.workflowDefaults,
      }),
    )

    let live: Array<{ id: string; label?: string }> | undefined
    let fetchedAt: string | undefined
    let stale: boolean | undefined
    let liveError: string | undefined
    let liveErrorCode: ListProviderModelsResult['liveErrorCode']

    const liveResult = await fetchLiveModelsForProvider(provider, ctx)
    if (liveResult) {
      live = sanitizeCursorLiveIds(liveResult.models)
      fetchedAt = liveResult.fetchedAt
      stale = liveResult.stale
      if (liveResult.error) {
        liveError = liveResult.error
      }
      if (liveResult.errorCode) {
        liveErrorCode = liveResult.errorCode
      }
    }

    const models = mergeProviderModelCandidates({
      live,
      history,
      workspace,
      suggested,
      saved,
    })

    return {
      models,
      ...(lastSelectedModel ? { lastSelectedModel } : {}),
      ...(fetchedAt ? { fetchedAt } : {}),
      ...(stale !== undefined ? { stale } : {}),
      ...(liveError ? { liveError } : {}),
      ...(liveErrorCode ? { liveErrorCode } : {}),
    }
  }

  listModelHistory(paths: SidecarPaths, provider?: string) {
    return this.modelHistoryStore.list(paths, provider)
  }

  deleteModelHistoryItem(
    paths: SidecarPaths,
    input: { provider: string; model: string },
  ): Promise<void> {
    return this.modelHistoryStore.deleteItem(paths, input)
  }
}
