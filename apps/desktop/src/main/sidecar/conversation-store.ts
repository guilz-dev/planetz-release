import { type ConversationEntry, conversationEntrySchema } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  insertConversation,
  listConversationsForTask,
} from '../storage/sqlite/repositories/conversation-repository.js'
import { buildConversationEntry } from './sidecar-entry-builders.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecords } from './sidecar-record-parse.js'

export class ConversationStore {
  async listForTask(paths: SidecarPaths, taskId: string): Promise<ConversationEntry[]> {
    const db = await getSidecarSqlite(paths)
    return parseSidecarRecords(listConversationsForTask(db, taskId), conversationEntrySchema)
  }

  async append(
    paths: SidecarPaths,
    input: Omit<ConversationEntry, 'id' | 'createdAt'>,
  ): Promise<ConversationEntry> {
    const db = await getSidecarSqlite(paths)
    const entry = buildConversationEntry(input)
    insertConversation(db, entry)
    return entry
  }
}
