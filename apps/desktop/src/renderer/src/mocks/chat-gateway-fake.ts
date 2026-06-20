import { sessionPolicyFromChatMode } from '@planetz/shared'
import type {
  ChatGateway,
  ChatSelectOption,
  ChatThreadSummary,
  ChatTurn,
} from '../components/chat/chat-types'

interface FakeChatGatewaySeed {
  threads?: ChatThreadSummary[]
  turnsByThread?: Record<string, ChatTurn[]>
  /** Ledger thread id → composer session id (stream IPC). Defaults to `composer_${threadId}`. */
  sessionIdByThread?: Record<string, string>
}

const DEFAULT_WORKSPACE_OPTIONS: ChatSelectOption[] = [{ value: '/repo/main', label: 'main' }]

const DEFAULT_BRANCH_OPTIONS: ChatSelectOption[] = [{ value: 'main', label: 'main' }]
const DEFAULT_PROVIDER_OPTIONS: ChatSelectOption[] = [
  { value: 'claude-sdk', label: 'Claude (API)' },
]
const DEFAULT_MODEL_OPTIONS: ChatSelectOption[] = [{ value: 'claude-sonnet-4', label: 'Sonnet 4' }]
const DEFAULT_EFFORT_OPTIONS: ChatSelectOption[] = [{ value: 'medium', label: 'medium' }]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Deterministic in-memory fake for contract-level tests.
 * Unlike the UI mock, this fake has no timers and no randomized replies.
 */
export type FakeChatGateway = ChatGateway & {
  searchThreads: NonNullable<ChatGateway['searchThreads']>
}

export function createFakeChatGateway(seed: FakeChatGatewaySeed = {}): FakeChatGateway {
  const threads = clone(seed.threads ?? [])
  const turnsByThread = clone(seed.turnsByThread ?? {})
  const sessionIdByThread = clone(seed.sessionIdByThread ?? {})
  let nextId = 1
  const makeId = (prefix: string) => `${prefix}_${nextId++}`

  const resolveSessionId = (threadId: string): string =>
    sessionIdByThread[threadId] ?? `composer_${threadId}`

  return {
    async listThreads(input) {
      if (!input?.workspacePath) return clone(threads)
      return clone(threads.filter((thread) => thread.workspacePath === input.workspacePath))
    },

    async searchThreads(input) {
      const q = input.query.trim().toLowerCase()
      const scoped = input.workspacePath
        ? threads.filter((thread) => thread.workspacePath === input.workspacePath)
        : threads
      if (!q) return clone(scoped)
      return clone(
        scoped.filter(
          (thread) =>
            thread.title.toLowerCase().includes(q) ||
            (turnsByThread[thread.id] ?? []).some((turn) => turn.content.toLowerCase().includes(q)),
        ),
      )
    },

    async getThread(threadId) {
      const thread = threads.find((entry) => entry.id === threadId)
      return {
        turns: clone(turnsByThread[threadId] ?? []),
        ...(thread?.sessionPolicy ? { sessionPolicy: thread.sessionPolicy } : {}),
      }
    },

    async getActiveComposerSessionId(threadId) {
      const thread = threads.find((entry) => entry.id === threadId)
      if (thread && !thread.hasActiveSession) {
        throw new Error(`Thread has no active session: ${threadId}`)
      }
      return resolveSessionId(threadId)
    },

    async restartThreadSession(input) {
      const thread = threads.find((entry) => entry.id === input.threadId)
      if (!thread) {
        throw new Error(`Conversation thread not found: ${input.threadId}`)
      }
      thread.sessionPolicy = sessionPolicyFromChatMode(input.mode)
      thread.hasActiveSession = true
      const composerSessionId = makeId('composer')
      sessionIdByThread[input.threadId] = composerSessionId
      return { composerSessionId }
    },

    async startThread(input) {
      const createdAt = new Date().toISOString()
      const threadId = makeId('thread')
      const seedBody = input.seedBody?.trim()
      const thread: ChatThreadSummary = {
        id: threadId,
        title: seedBody && seedBody.length > 0 ? seedBody : 'Untitled',
        workspacePath: input.workspacePath,
        workspaceLabel: input.workspacePath.split('/').filter(Boolean).at(-1) ?? 'workspace',
        updatedAt: createdAt,
        hasActiveSession: input.mode === 'interactive',
      }
      threads.unshift(thread)
      sessionIdByThread[threadId] = resolveSessionId(threadId)
      turnsByThread[threadId] = seedBody
        ? [{ id: makeId('turn'), role: 'user', content: seedBody, createdAt }]
        : []
      return { threadId }
    },

    async finalizeThread(input) {
      const turns = turnsByThread[input.threadId] ?? []
      const lastUser = [...turns].reverse().find((turn) => turn.role === 'user')
      const thread = threads.find((entry) => entry.id === input.threadId)
      if (thread) thread.hasActiveSession = false
      return { body: lastUser?.content ?? '' }
    },

    async sendMessage(input) {
      const now = new Date().toISOString()
      let turns = turnsByThread[input.threadId]
      if (!turns) {
        turns = []
        turnsByThread[input.threadId] = turns
      }
      turns.push({
        id: makeId('turn'),
        role: 'user',
        content: input.message,
        createdAt: now,
      })
      turns.push({
        id: makeId('turn'),
        role: 'assistant',
        content: `Echo: ${input.message}`,
        createdAt: now,
      })
      const thread = threads.find((candidate) => candidate.id === input.threadId)
      if (thread) thread.updatedAt = now
      return {}
    },

    async getFormOptions() {
      return {
        workspaces: clone(DEFAULT_WORKSPACE_OPTIONS),
        branches: clone(DEFAULT_BRANCH_OPTIONS),
        providers: clone(DEFAULT_PROVIDER_OPTIONS),
        models: clone(DEFAULT_MODEL_OPTIONS),
        modelsByProvider: { 'claude-sdk': clone(DEFAULT_MODEL_OPTIONS) },
        efforts: clone(DEFAULT_EFFORT_OPTIONS),
        effortsByProvider: { 'claude-sdk': clone(DEFAULT_EFFORT_OPTIONS) },
        defaultProvider: DEFAULT_PROVIDER_OPTIONS[0]?.value,
        defaultModel: DEFAULT_MODEL_OPTIONS[0]?.value,
        defaultEffort: DEFAULT_EFFORT_OPTIONS[0]?.value,
      }
    },

    async cancelSend() {},
  }
}
