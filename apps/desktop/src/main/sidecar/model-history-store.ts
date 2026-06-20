import {
  MODEL_HISTORY_MAX_ITEMS,
  type ModelHistoryItem,
  modelHistoryItemSchema,
} from '@planetz/shared'
import type { UsageHistoryRow } from '../storage/sqlite/repositories/usage-history-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { UsageHistoryStore } from './usage-history-store.js'

function toModelHistoryItem(row: UsageHistoryRow): ModelHistoryItem {
  return {
    provider: row.provider,
    model: row.value,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
  }
}

const modelUsageStore = new UsageHistoryStore<ModelHistoryItem>({
  kind: 'model',
  maxItems: MODEL_HISTORY_MAX_ITEMS,
  schema: modelHistoryItemSchema,
  rowToItem: toModelHistoryItem,
  parseLabel: 'model history',
  missingUpsertMessage: 'provider and model are required for model history upsert',
  toUpsertInput: (input) => ({
    provider: input.provider.trim(),
    value: input.model.trim(),
  }),
  toDeleteInput: (input) => ({
    provider: input.provider.trim(),
    value: input.model.trim(),
  }),
})

export class ModelHistoryStore {
  list(paths: SidecarPaths, providerFilter?: string): Promise<ModelHistoryItem[]> {
    return modelUsageStore.list(paths, providerFilter)
  }

  upsert(
    paths: SidecarPaths,
    input: { provider: string; model: string },
  ): Promise<ModelHistoryItem> {
    return modelUsageStore.upsert(paths, input)
  }

  deleteItem(paths: SidecarPaths, input: { provider: string; model: string }): Promise<void> {
    return modelUsageStore.deleteItem(paths, input)
  }
}
