import type {
  ArtifactRef,
  ConversationHistoryThreadSummary,
  ConversationHistoryTurn,
  ConversationThreadStatus,
  PlanetzSessionPolicy,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  listArtifactsForThread,
  saveArtifactRefs,
} from '../storage/sqlite/repositories/conversation-artifact-repository.js'
import {
  appendThreadTurnsTransactional,
  type ConversationLedgerTurnInsert,
  clearActiveSessionId,
  countTurnsForThread,
  deleteThread,
  findOpenThreadByActiveSessionId,
  findOpenThreadWorkspaceByActiveSessionId,
  getThreadWithTurns,
  insertConversationThread,
  insertConversationTurn,
  listOpenThreads,
  rebindOpenThreadSession,
  searchOpenThreads,
  updateThreadTitleIfDefault,
} from '../storage/sqlite/repositories/conversation-ledger-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'

export class ConversationLedgerStore {
  async listOpen(
    paths: SidecarPaths,
    workspacePath: string,
    limit?: number,
  ): Promise<ConversationHistoryThreadSummary[]> {
    const db = await getSidecarSqlite(paths)
    return listOpenThreads(db, workspacePath, limit)
  }

  async getWithTurns(
    paths: SidecarPaths,
    workspacePath: string,
    threadId: string,
  ): Promise<{
    thread: ConversationHistoryThreadSummary
    turns: ConversationHistoryTurn[]
  } | null> {
    const db = await getSidecarSqlite(paths)
    return getThreadWithTurns(db, threadId, workspacePath)
  }

  async delete(paths: SidecarPaths, workspacePath: string, threadId: string): Promise<boolean> {
    const db = await getSidecarSqlite(paths)
    return deleteThread(db, threadId, workspacePath)
  }

  async searchOpen(
    paths: SidecarPaths,
    workspacePath: string,
    query: string,
    limit?: number,
  ): Promise<ConversationHistoryThreadSummary[]> {
    const db = await getSidecarSqlite(paths)
    return searchOpenThreads(db, query, workspacePath, limit)
  }

  /** Used by tests and composer conversation ledger writes. */
  async insertThread(
    paths: SidecarPaths,
    input: {
      threadId: string
      workspacePath: string
      branch?: string | null
      title: string
      status?: ConversationThreadStatus
      updatedAt: string
      activeSessionId?: string | null
      sessionPolicy?: PlanetzSessionPolicy | null
    },
  ): Promise<void> {
    const db = await getSidecarSqlite(paths)
    insertConversationThread(db, input)
  }

  /** Used by tests and direct turn inserts. */
  async insertTurn(
    paths: SidecarPaths,
    input: {
      turnId: string
      threadId: string
      turnIndex: number
      role: 'user' | 'assistant'
      provider?: string | null
      content: string
      metadataJson?: string | null
      createdAt: string
    },
  ): Promise<void> {
    const db = await getSidecarSqlite(paths)
    insertConversationTurn(db, input)
  }

  async findWorkspaceByActiveSessionId(
    paths: SidecarPaths,
    activeSessionId: string,
  ): Promise<string | null> {
    const db = await getSidecarSqlite(paths)
    return findOpenThreadWorkspaceByActiveSessionId(db, activeSessionId)
  }

  async appendTurnsTransactional(
    paths: SidecarPaths,
    input: {
      activeSessionId: string
      workspacePath: string
      updatedAt: string
      titleFromFirstUserMessage?: string
      turns: ConversationLedgerTurnInsert[]
    },
  ): Promise<void> {
    const db = await getSidecarSqlite(paths)
    const row = findOpenThreadByActiveSessionId(db, input.activeSessionId, input.workspacePath)
    if (!row) {
      throw new Error(`No open conversation thread for session ${input.activeSessionId}`)
    }
    appendThreadTurnsTransactional(db, {
      threadId: row.thread_id,
      workspacePath: input.workspacePath,
      turns: input.turns,
      updatedAt: input.updatedAt,
      titleFromFirstUserMessage: input.titleFromFirstUserMessage,
    })
  }

  async rebindThreadSession(
    paths: SidecarPaths,
    input: {
      threadId: string
      workspacePath: string
      activeSessionId: string
      sessionPolicy: PlanetzSessionPolicy
      updatedAt: string
    },
  ): Promise<boolean> {
    const db = await getSidecarSqlite(paths)
    return rebindOpenThreadSession(db, input)
  }

  async clearActiveSession(
    paths: SidecarPaths,
    activeSessionId: string,
    workspacePath: string,
    updatedAt: string,
  ): Promise<void> {
    const db = await getSidecarSqlite(paths)
    const row = findOpenThreadByActiveSessionId(db, activeSessionId, workspacePath)
    if (!row) return
    clearActiveSessionId(db, row.thread_id, workspacePath, updatedAt)
  }

  async saveArtifacts(
    paths: SidecarPaths,
    threadId: string,
    refs: ArtifactRef[],
    payloadByRef?: Map<string, string>,
  ): Promise<void> {
    if (refs.length === 0) return
    const db = await getSidecarSqlite(paths)
    saveArtifactRefs(db, threadId, refs, payloadByRef)
  }

  async listArtifacts(paths: SidecarPaths, threadId: string) {
    const db = await getSidecarSqlite(paths)
    return listArtifactsForThread(db, threadId)
  }

  async updateTitleIfDefault(
    paths: SidecarPaths,
    threadId: string,
    workspacePath: string,
    title: string,
    updatedAt: string,
  ): Promise<boolean> {
    const db = await getSidecarSqlite(paths)
    return updateThreadTitleIfDefault(db, threadId, workspacePath, title, updatedAt)
  }

  async countTurns(paths: SidecarPaths, threadId: string): Promise<number> {
    const db = await getSidecarSqlite(paths)
    return countTurnsForThread(db, threadId)
  }
}
