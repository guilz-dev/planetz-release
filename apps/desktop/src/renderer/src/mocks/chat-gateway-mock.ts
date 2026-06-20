/**
 * In-memory mock implementation of {@link ChatGateway}.
 *
 * Holds conversation state in memory so the UI can exercise the full
 * new-chat / select / send round-trip without a backend. The real
 * implementation will replace this module (via `use-chat-gateway` DI) with a
 * gateway backed by `use-conversation-session` + the conversation ledger; no
 * view code changes when that swap happens (UI design doc §14.6).
 *
 * Does not simulate `composerSession:stream` push events (replies appear in one
 * shot). Use `PLANETZ_CHAT_MODE=0` or `PLANETZ_CHAT_GATEWAY=mock` to force this mock.
 * to exercise live streaming via {@link createOrbitChatGateway}.
 */
import { sessionPolicyFromChatMode } from '@planetz/shared'
import type {
  ChatGateway,
  ChatMode,
  ChatThreadSummary,
  ChatTurn,
} from '../components/chat/chat-types'
import {
  CHAT_BRANCH_OPTIONS,
  CHAT_MODEL_OPTIONS,
  CHAT_PROVIDER_OPTIONS,
  CHAT_THREAD_FIXTURES,
  CHAT_TURN_FIXTURES,
  CHAT_WORKSPACE_OPTIONS,
  MOCK_ASSISTANT_REPLIES,
} from './chat-fixtures'

/** Simulated IPC latency so loading states are visible. */
const LATENCY_MS = 220

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createMockChatGateway(): ChatGateway {
  // Mutable in-memory stores, seeded from fixtures.
  const threads: ChatThreadSummary[] = clone(CHAT_THREAD_FIXTURES)
  const turnsByThread: Record<string, ChatTurn[]> = clone(CHAT_TURN_FIXTURES)
  const untitledThreadIds = new Set<string>()
  let replyCursor = 0
  let nextId = 1
  const makeId = (prefix: string) => `${prefix}_${Date.now()}_${nextId++}`

  return {
    async listThreads(input) {
      const filtered = input?.workspacePath
        ? threads.filter((thread) => thread.workspacePath === input.workspacePath)
        : threads
      const sorted = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return delay(clone(sorted))
    },

    async searchThreads(input) {
      const q = input.query.trim().toLowerCase()
      const scoped = input.workspacePath
        ? threads.filter((thread) => thread.workspacePath === input.workspacePath)
        : threads
      if (!q) return delay(clone(scoped))
      return delay(
        clone(
          scoped.filter(
            (thread) =>
              thread.title.toLowerCase().includes(q) ||
              (turnsByThread[thread.id] ?? []).some((turn) =>
                turn.content.toLowerCase().includes(q),
              ),
          ),
        ),
      )
    },

    async getThread(threadId) {
      const thread = threads.find((entry) => entry.id === threadId)
      return delay({
        turns: clone(turnsByThread[threadId] ?? []),
        ...(thread?.sessionPolicy ? { sessionPolicy: thread.sessionPolicy } : {}),
      })
    },

    async getActiveComposerSessionId(threadId) {
      const thread = threads.find((entry) => entry.id === threadId)
      if (!thread) {
        throw new Error(`Conversation thread not found: ${threadId}`)
      }
      if (!thread.hasActiveSession) {
        throw new Error(`Thread has no active session: ${threadId}`)
      }
      return delay(`composer_${threadId}`)
    },

    async startThread(input) {
      const threadId = makeId('thr')
      const seed = input.seedBody?.trim()
      const workspace =
        CHAT_WORKSPACE_OPTIONS.find((option) => option.value === input.workspacePath) ??
        CHAT_WORKSPACE_OPTIONS[0]
      if (!seed) untitledThreadIds.add(threadId)
      threads.unshift({
        id: threadId,
        title: seed ? truncateTitle(seed) : '',
        workspacePath: workspace.value,
        workspaceLabel: workspace.label,
        updatedAt: new Date().toISOString(),
        hasActiveSession: true,
        sessionPolicy: sessionPolicyFromChatMode(input.mode),
      })
      turnsByThread[threadId] = []
      return delay({ threadId }, 120)
    },

    async restartThreadSession(input) {
      const thread = threads.find((entry) => entry.id === input.threadId)
      if (!thread) {
        throw new Error(`Conversation thread not found: ${input.threadId}`)
      }
      thread.sessionPolicy = sessionPolicyFromChatMode(input.mode)
      thread.hasActiveSession = true
      thread.updatedAt = new Date().toISOString()
      return delay({ composerSessionId: `composer_${input.threadId}` })
    },

    async sendMessage(input) {
      const turns = turnsByThread[input.threadId] ?? []
      turnsByThread[input.threadId] = turns
      turns.push({
        id: makeId('m'),
        role: 'user',
        content: input.message,
        createdAt: new Date().toISOString(),
      })
      const reply = MOCK_ASSISTANT_REPLIES[replyCursor % MOCK_ASSISTANT_REPLIES.length]
      replyCursor += 1
      turns.push({
        id: makeId('m'),
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      })
      const thread = threads.find((entry) => entry.id === input.threadId)
      if (thread) {
        thread.updatedAt = new Date().toISOString()
        if (untitledThreadIds.has(thread.id)) {
          thread.title = truncateTitle(input.message)
          untitledThreadIds.delete(thread.id)
        }
      }
      // Assistant reply takes a beat longer to feel like a real turn.
      await delay(null, 480)
      return {}
    },

    async cancelSend() {
      await delay(null, 0)
    },

    async finalizeThread(input) {
      const turns = turnsByThread[input.threadId] ?? []
      const lastUser = [...turns].reverse().find((turn) => turn.role === 'user')
      const body = lastUser?.content ?? ''
      const thread = threads.find((entry) => entry.id === input.threadId)
      if (thread) {
        thread.hasActiveSession = false
        thread.updatedAt = new Date().toISOString()
      }
      return delay({
        body: `${body}\n\n(Mock spec preview)`,
        allowedActions: ['save_task', 'continue'] as const,
      })
    },

    async getFormOptions() {
      return delay({
        workspaces: clone(CHAT_WORKSPACE_OPTIONS),
        branches: clone(CHAT_BRANCH_OPTIONS),
        providers: clone(CHAT_PROVIDER_OPTIONS),
        models: clone(CHAT_MODEL_OPTIONS),
        modelsByProvider: Object.fromEntries(
          CHAT_PROVIDER_OPTIONS.map((provider) => [provider.value, clone(CHAT_MODEL_OPTIONS)]),
        ),
        efforts: [],
        effortsByProvider: {},
        defaultProvider: CHAT_PROVIDER_OPTIONS[0]?.value,
        defaultModel: CHAT_MODEL_OPTIONS[0]?.value,
        defaultEffort: '',
      })
    },
  }
}

const TITLE_MAX = 40

function truncateTitle(text: string): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  const normalized = firstLine ?? text.trim()
  if (normalized.length <= TITLE_MAX) return normalized
  return `${normalized.slice(0, TITLE_MAX - 1).trimEnd()}…`
}

// Re-exported for callers that only need the mode type alongside the gateway.
export type { ChatMode }
