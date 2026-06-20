import {
  COMPOSER_ASSIST_SESSION_KV_KEY,
  type ComposerAssistSessionSnapshot,
  composerAssistSessionSnapshotSchema,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecord } from './sidecar-record-parse.js'

export type { ComposerAssistSessionSnapshot }

export class ComposerSessionStore {
  async load(paths: SidecarPaths): Promise<ComposerAssistSessionSnapshot | null> {
    const db = await getSidecarSqlite(paths)
    const raw = readKvJson(db, COMPOSER_ASSIST_SESSION_KV_KEY)
    if (!raw) return null
    return parseSidecarRecord(raw, composerAssistSessionSnapshotSchema, 'composer assist session')
  }

  async save(paths: SidecarPaths, snapshot: ComposerAssistSessionSnapshot): Promise<void> {
    const db = await getSidecarSqlite(paths)
    const valid = parseSidecarRecord(
      snapshot,
      composerAssistSessionSnapshotSchema,
      'composer assist session',
    )
    writeKvJson(db, COMPOSER_ASSIST_SESSION_KV_KEY, valid)
  }

  async clear(paths: SidecarPaths): Promise<void> {
    const db = await getSidecarSqlite(paths)
    db.prepare('DELETE FROM kv_store WHERE key = ?').run(COMPOSER_ASSIST_SESSION_KV_KEY)
  }
}
