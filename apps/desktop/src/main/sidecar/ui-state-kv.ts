import type { DatabaseSync } from 'node:sqlite'
import type { UiState } from '@planetz/shared'
import { writeKvJson } from '../storage/sqlite/kv-store.js'
import { UI_STATE_KV_KEY } from './sidecar-kv-keys.js'

/** Persist ui.state kv entry. Caller owns transaction boundaries. */
export function writeUiStateKv(db: DatabaseSync, state: UiState): void {
  writeKvJson(db, UI_STATE_KV_KEY, state)
}
