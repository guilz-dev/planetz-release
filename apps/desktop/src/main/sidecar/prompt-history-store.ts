import {
  PROMPT_HISTORY_MAX_ITEMS,
  type PromptHistoryItem,
  promptHistoryItemSchema,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  deletePromptHistoryById,
  insertPromptHistory,
  listPromptHistory,
  replaceAllPromptHistory,
  trimPromptHistory,
} from '../storage/sqlite/repositories/prompt-history-repository.js'
import { runSidecarTransaction } from '../storage/sqlite/transaction.js'
import { buildSubmittedPromptHistoryItem } from './sidecar-entry-builders.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecords } from './sidecar-record-parse.js'

export class PromptHistoryStore {
  async list(paths: SidecarPaths, limit = PROMPT_HISTORY_MAX_ITEMS): Promise<PromptHistoryItem[]> {
    const db = await getSidecarSqlite(paths)
    return parseSidecarRecords(listPromptHistory(db, limit), promptHistoryItemSchema)
  }

  async save(paths: SidecarPaths, items: PromptHistoryItem[]): Promise<void> {
    const db = await getSidecarSqlite(paths)
    const validItems = parseSidecarRecords(
      items.slice(0, PROMPT_HISTORY_MAX_ITEMS),
      promptHistoryItemSchema,
    )
    runSidecarTransaction(db, () => {
      replaceAllPromptHistory(db, validItems)
    })
  }

  async appendSubmitted(
    paths: SidecarPaths,
    input: {
      title: string
      body: string
      workflow?: string
      autoDecision?: PromptHistoryItem['autoDecision']
      assignedAgentId?: string
      issueRef?: string
      submittedTaskId: string
    },
  ): Promise<PromptHistoryItem> {
    const db = await getSidecarSqlite(paths)
    const item = buildSubmittedPromptHistoryItem(input)
    runSidecarTransaction(db, () => {
      insertPromptHistory(db, item)
      trimPromptHistory(db, PROMPT_HISTORY_MAX_ITEMS)
    })
    return item
  }

  async deleteItem(paths: SidecarPaths, id: string): Promise<void> {
    const db = await getSidecarSqlite(paths)
    deletePromptHistoryById(db, id)
  }
}
