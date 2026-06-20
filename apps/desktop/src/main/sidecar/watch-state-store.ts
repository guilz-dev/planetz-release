import { watchStateFileSchema } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import type { SidecarPaths } from './sidecar-paths.js'

export interface WatchStateRecord {
  pid?: number
  startedAt?: string
  lastError?: string
}

const WATCH_STATE_KV_KEY = 'watch.state'

export class WatchStateStore {
  async load(paths: SidecarPaths): Promise<WatchStateRecord> {
    const db = await getSidecarSqlite(paths)
    const parsed = watchStateFileSchema.safeParse(readKvJson(db, WATCH_STATE_KV_KEY))
    return parsed.success ? parsed.data : {}
  }

  async save(paths: SidecarPaths, state: WatchStateRecord): Promise<void> {
    const db = await getSidecarSqlite(paths)
    writeKvJson(db, WATCH_STATE_KV_KEY, state)
  }

  async clear(paths: SidecarPaths): Promise<void> {
    const db = await getSidecarSqlite(paths)
    writeKvJson(db, WATCH_STATE_KV_KEY, {})
  }
}
