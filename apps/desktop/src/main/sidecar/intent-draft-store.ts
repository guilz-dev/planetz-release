import { type IntentDraft, intentDraftSchema } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import { specStudioIntentDraftKvKey } from './sidecar-kv-keys.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecord } from './sidecar-record-parse.js'

export class IntentDraftStore {
  async load(paths: SidecarPaths, threadId: string): Promise<IntentDraft | null> {
    const db = await getSidecarSqlite(paths)
    const raw = readKvJson(db, specStudioIntentDraftKvKey(threadId))
    if (!raw) return null
    return parseSidecarRecord(raw, intentDraftSchema, 'intent draft')
  }

  async save(paths: SidecarPaths, draft: IntentDraft): Promise<IntentDraft> {
    const db = await getSidecarSqlite(paths)
    const valid = parseSidecarRecord(draft, intentDraftSchema, 'intent draft')
    writeKvJson(db, specStudioIntentDraftKvKey(valid.threadId), valid)
    return valid
  }

  async clear(paths: SidecarPaths, threadId: string): Promise<void> {
    const db = await getSidecarSqlite(paths)
    db.prepare('DELETE FROM kv_store WHERE key = ?').run(specStudioIntentDraftKvKey(threadId))
  }
}
