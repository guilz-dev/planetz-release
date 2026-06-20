import {
  EFFORT_HISTORY_MAX_ITEMS,
  type EffortHistoryItem,
  effortHistoryItemSchema,
} from '@planetz/shared'
import type { UsageHistoryRow } from '../storage/sqlite/repositories/usage-history-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { UsageHistoryStore } from './usage-history-store.js'

function toEffortHistoryItem(row: UsageHistoryRow): EffortHistoryItem {
  return {
    provider: row.provider,
    effort: row.value,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
  }
}

const effortUsageStore = new UsageHistoryStore<EffortHistoryItem>({
  kind: 'effort',
  maxItems: EFFORT_HISTORY_MAX_ITEMS,
  schema: effortHistoryItemSchema,
  rowToItem: toEffortHistoryItem,
  parseLabel: 'effort history',
  missingUpsertMessage: 'provider and effort are required for effort history upsert',
  toUpsertInput: (input) => ({
    provider: input.provider.trim(),
    value: input.effort.trim(),
  }),
  toDeleteInput: (input) => ({
    provider: input.provider.trim(),
    value: input.effort.trim(),
  }),
})

export class EffortHistoryStore {
  list(paths: SidecarPaths, providerFilter?: string): Promise<EffortHistoryItem[]> {
    return effortUsageStore.list(paths, providerFilter)
  }

  upsert(
    paths: SidecarPaths,
    input: { provider: string; effort: string },
  ): Promise<EffortHistoryItem> {
    return effortUsageStore.upsert(paths, input)
  }

  deleteItem(paths: SidecarPaths, input: { provider: string; effort: string }): Promise<void> {
    return effortUsageStore.deleteItem(paths, input)
  }
}
