import {
  type ComposerSessionStartInput,
  DEFAULT_CONVERSATION_THREAD_TITLE,
  resolveSessionPolicy,
} from '@planetz/shared'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

const CONVERSATION_TITLE_MAX_LEN = 80

export function truncateConversationTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized) return DEFAULT_CONVERSATION_THREAD_TITLE
  if (normalized.length <= CONVERSATION_TITLE_MAX_LEN) return normalized
  return `${normalized.slice(0, CONVERSATION_TITLE_MAX_LEN - 1)}…`
}

export type ComposerConversationLedgerWriterDeps = {
  ledgerStore: ConversationLedgerStore
  requireSidecarPaths: () => SidecarPaths
}

/** Persists composer chat sessions into the conversation ledger (main only). */
export class ComposerConversationLedgerWriter {
  constructor(private readonly deps: ComposerConversationLedgerWriterDeps) {}

  async createThreadOnStartSuccess(
    input: ComposerSessionStartInput,
    sessionId: string,
  ): Promise<void> {
    const ledger = input.conversationLedger
    if (!ledger) return
    const paths = this.deps.requireSidecarPaths()
    const now = new Date().toISOString()
    const sessionPolicy = resolveSessionPolicy(input)
    const existingThreadId = ledger.existingThreadId?.trim()
    if (existingThreadId) {
      const rebound = await this.deps.ledgerStore.rebindThreadSession(paths, {
        threadId: existingThreadId,
        workspacePath: ledger.workspacePath,
        activeSessionId: sessionId,
        sessionPolicy,
        updatedAt: now,
      })
      if (!rebound) {
        throw new Error(`Conversation thread not found for session rebind: ${existingThreadId}`)
      }
      return
    }
    const title = ledger.title?.trim() || DEFAULT_CONVERSATION_THREAD_TITLE
    await this.deps.ledgerStore.insertThread(paths, {
      threadId: sessionId,
      workspacePath: ledger.workspacePath,
      branch: ledger.branch ?? null,
      title,
      updatedAt: now,
      activeSessionId: sessionId,
      sessionPolicy,
    })
  }

  async appendInteractiveMessage(
    sessionId: string,
    workspacePath: string,
    userMessage: string,
    assistantMessage: string,
    provider?: string | null,
  ): Promise<void> {
    const paths = this.deps.requireSidecarPaths()
    const now = new Date().toISOString()
    const titleFromFirstUser = truncateConversationTitle(userMessage)
    await this.deps.ledgerStore.appendTurnsTransactional(paths, {
      activeSessionId: sessionId,
      workspacePath,
      updatedAt: now,
      titleFromFirstUserMessage: titleFromFirstUser,
      turns: [
        {
          turnId: `turn_${crypto.randomUUID()}`,
          role: 'user',
          content: userMessage,
          createdAt: now,
        },
        {
          turnId: `turn_${crypto.randomUUID()}`,
          role: 'assistant',
          content: assistantMessage,
          provider: provider ?? null,
          createdAt: now,
        },
      ],
    })
  }

  async clearActiveSession(sessionId: string, workspacePath: string): Promise<void> {
    const paths = this.deps.requireSidecarPaths()
    const now = new Date().toISOString()
    await this.deps.ledgerStore.clearActiveSession(paths, sessionId, workspacePath, now)
  }
}
