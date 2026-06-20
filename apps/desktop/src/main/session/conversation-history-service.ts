import type {
  ConversationHistoryDeleteInput,
  ConversationHistoryDeleteResult,
  ConversationHistoryGetInput,
  ConversationHistoryGetResult,
  ConversationHistoryListInput,
  ConversationHistoryListResult,
  ConversationHistorySearchInput,
  ConversationHistorySearchResult,
} from '@planetz/shared'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

export type ConversationHistoryServiceDeps = {
  requireWorkspacePath: () => string
  requireSidecarPaths: () => SidecarPaths
  ledgerStore: ConversationLedgerStore
}

export class ConversationHistoryService {
  constructor(private readonly deps: ConversationHistoryServiceDeps) {}

  /**
   * Lists open conversation threads for the currently open workspace.
   * Optional `workspacePath` on IPC input is ignored (current workspace is canonical).
   */
  async list(input?: ConversationHistoryListInput): Promise<ConversationHistoryListResult> {
    return this.withLedger(async (paths, workspacePath) => {
      const threads = await this.deps.ledgerStore.listOpen(paths, workspacePath, input?.limit)
      return { threads }
    })
  }

  async get(input: ConversationHistoryGetInput): Promise<ConversationHistoryGetResult> {
    return this.withLedger(async (paths, workspacePath) => {
      const found = await this.deps.ledgerStore.getWithTurns(paths, workspacePath, input.threadId)
      if (!found) return { found: false }
      return {
        found: true,
        thread: found.thread,
        turns: found.turns,
      }
    })
  }

  async delete(input: ConversationHistoryDeleteInput): Promise<ConversationHistoryDeleteResult> {
    return this.withLedger(async (paths, workspacePath) => {
      const deleted = await this.deps.ledgerStore.delete(paths, workspacePath, input.threadId)
      return { ok: true, deleted }
    })
  }

  async search(input: ConversationHistorySearchInput): Promise<ConversationHistorySearchResult> {
    return this.withLedger(async (paths, workspacePath) => {
      const threads = await this.deps.ledgerStore.searchOpen(
        paths,
        workspacePath,
        input.query,
        input.limit,
      )
      return { threads }
    })
  }

  private async withLedger<T>(
    fn: (paths: SidecarPaths, workspacePath: string) => Promise<T>,
  ): Promise<T> {
    const paths = this.deps.requireSidecarPaths()
    const workspacePath = this.deps.requireWorkspacePath()
    return fn(paths, workspacePath)
  }
}
