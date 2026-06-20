import {
  CHAT_COMPOSER_DRAFT_KV_KEY,
  type ChatComposerDraftSnapshot,
  chatComposerDraftSnapshotSchema,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecord } from './sidecar-record-parse.js'

export class ChatComposerDraftStore {
  async load(paths: SidecarPaths): Promise<ChatComposerDraftSnapshot | null> {
    const db = await getSidecarSqlite(paths)
    const raw = readKvJson(db, CHAT_COMPOSER_DRAFT_KV_KEY)
    if (!raw) return null
    return parseSidecarRecord(raw, chatComposerDraftSnapshotSchema, 'chat composer draft')
  }

  async save(paths: SidecarPaths, snapshot: ChatComposerDraftSnapshot): Promise<void> {
    const db = await getSidecarSqlite(paths)
    const valid = parseSidecarRecord(
      snapshot,
      chatComposerDraftSnapshotSchema,
      'chat composer draft',
    )
    writeKvJson(db, CHAT_COMPOSER_DRAFT_KV_KEY, valid)
  }
}
