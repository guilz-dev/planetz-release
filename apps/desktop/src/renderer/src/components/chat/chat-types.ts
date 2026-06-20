import type {
  ChatComposerDraftSnapshot,
  ConversationCompactionSummary,
  PlanetzSessionPolicy,
} from '@planetz/shared'
import type { ChatMode } from '../../types/chat-mode'

export type { ChatMode } from '../../types/chat-mode'

/**
 * Conversation Mode — UI-facing types.
 *
 * These types form the contract between the presentational chat components and
 * the data layer (`ChatGateway`). Presentational components only ever see these
 * shapes; they never touch `window.orbit`, IPC names, or DB schemas (see UI
 * design doc §14.5). The mock gateway and the future real gateway both satisfy
 * `ChatGateway`, so swapping data sources never touches the view layer.
 */

/** One conversation thread, as listed in the history sidebar. */
export interface ChatThreadSummary {
  id: string
  title: string
  /** Absolute workspace path this thread belongs to (used for grouping). */
  workspacePath: string
  /** Human label for the workspace (folder name). */
  workspaceLabel: string
  /** ISO timestamp of the last activity. */
  updatedAt: string
  /** True while an interactive session for this thread is still open. */
  hasActiveSession: boolean
  /** Composer session id when `hasActiveSession` is true (chat apply / stream). */
  activeSessionId?: string
  /** Persisted headless session policy; omitted on legacy threads. */
  sessionPolicy?: PlanetzSessionPolicy
}

/** One turn (message) inside a thread. */
export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

/** Result of loading a thread's turns and optional session policy metadata. */
export type ChatThreadLoadResult = {
  turns: ChatTurn[]
  sessionPolicy?: PlanetzSessionPolicy
}

/** A selectable option for the composer form dropdowns. */
export interface ChatSelectOption {
  value: string
  label: string
}

/**
 * Data boundary for Conversation Mode. The mock and the real implementation
 * both implement this. Container components depend on this interface only.
 */
export interface ChatGateway {
  listThreads(input?: { workspacePath?: string }): Promise<ChatThreadSummary[]>
  /** Server-side search (current workspace). Optional on mocks. */
  searchThreads?(input: { query: string; workspacePath?: string }): Promise<ChatThreadSummary[]>
  getThread(threadId: string): Promise<ChatThreadLoadResult>
  /**
   * Composer session id for stderr stream filtering (`composerSession:stream`).
   * May differ from ledger `threadId` when the thread outlives a single session.
   */
  getActiveComposerSessionId(threadId: string): Promise<string>
  startThread(input: {
    seedBody?: string
    sourceContext?: string
    workspacePath: string
    branch?: string
    provider?: string
    model?: string
    effort?: string
    mode: ChatMode
  }): Promise<{ threadId: string }>
  /** Rebinds an open ledger thread to a new composer session (mode / policy change). */
  restartThreadSession?(input: {
    threadId: string
    workspacePath: string
    branch?: string
    provider?: string
    model?: string
    effort?: string
    mode: ChatMode
  }): Promise<{ composerSessionId: string }>
  sendMessage(input: {
    threadId: string
    message: string
    /** When set, skips a second ledger lookup in the real gateway. */
    composerSessionId?: string
  }): Promise<{ compactionSummary?: ConversationCompactionSummary }>
  /** Spec mode: finalize the active session and return the task body preview. */
  finalizeThread(input: { threadId: string }): Promise<{
    body: string
    allowedActions?: Array<'execute' | 'save_task' | 'continue'>
  }>
  /** Options used to populate the composer form selectors. */
  getFormOptions(): Promise<{
    workspaces: ChatSelectOption[]
    branches: ChatSelectOption[]
    providers: ChatSelectOption[]
    models: ChatSelectOption[]
    modelsByProvider?: Record<string, ChatSelectOption[]>
    lastSelectedModelByProvider?: Record<string, string>
    efforts?: ChatSelectOption[]
    effortsByProvider?: Record<string, ChatSelectOption[]>
    defaultBranch?: string
    defaultProvider?: string
    defaultModel?: string
    defaultEffort?: string
  }>
  /** Best-effort cancel for an in-flight send (UI may ignore late responses). */
  cancelSend?(input: { threadId: string }): Promise<void>
  /** Load unsent composer draft state for the open workspace sidecar. */
  loadComposerDraft?(): Promise<ChatComposerDraftSnapshot | null>
  /** Persist unsent composer draft state for the open workspace sidecar. */
  saveComposerDraft?(snapshot: ChatComposerDraftSnapshot): Promise<void>
}
