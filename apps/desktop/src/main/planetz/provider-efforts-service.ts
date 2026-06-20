import {
  catalogEffortOptions,
  type EngineConfig,
  type ExecutionCatalog,
  type ExecutionProfileOverrides,
  effortHintsForOrbitProvider,
  effortProviderBucket,
  type ListProviderEffortsResult,
  mergeProviderEffortCandidates,
  readEffortFromEngineConfig,
} from '@planetz/shared'
import type { EffortHistoryStore } from '../sidecar/effort-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

export interface ListProviderEffortsContext {
  paths: SidecarPaths
  provider: string
  catalog: ExecutionCatalog
  engineConfig?: EngineConfig | null
  workflowDefaults?: ExecutionProfileOverrides
  currentEffort?: string
}

export class ProviderEffortsService {
  constructor(private readonly effortHistoryStore: EffortHistoryStore) {}

  async listProviderEfforts(ctx: ListProviderEffortsContext): Promise<ListProviderEffortsResult> {
    const provider = ctx.provider.trim()
    const historyItems = await this.effortHistoryStore.list(ctx.paths, provider)
    const history = historyItems.map((item) => item.effort)

    const bucket = effortProviderBucket(provider)
    const catalogKey = bucket ?? provider
    const workspace = catalogEffortOptions(catalogKey, ctx.catalog, [])
    const suggested = [...effortHintsForOrbitProvider(provider)]
    const saved: string[] = []
    const currentEffort = ctx.currentEffort?.trim()
    if (currentEffort) saved.push(currentEffort)
    const engineEffort = readEffortFromEngineConfig(ctx.engineConfig)
    if (engineEffort) saved.push(engineEffort)
    const workflowEffort = ctx.workflowDefaults?.effort?.trim()
    if (workflowEffort) saved.push(workflowEffort)

    const efforts = mergeProviderEffortCandidates({
      history,
      workspace,
      suggested,
      saved,
    })

    return { efforts }
  }

  listEffortHistory(paths: SidecarPaths, provider?: string) {
    return this.effortHistoryStore.list(paths, provider)
  }

  deleteEffortHistoryItem(
    paths: SidecarPaths,
    input: { provider: string; effort: string },
  ): Promise<void> {
    return this.effortHistoryStore.deleteItem(paths, input)
  }
}
