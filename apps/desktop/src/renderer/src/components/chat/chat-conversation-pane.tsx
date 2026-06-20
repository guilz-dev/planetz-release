import { GitBranch } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ChatInFlightPresentation } from '../../lib/in-flight-chat-status'
import { type ChatEmptyCopyVariant, ChatEmptyState } from './chat-empty-state'
import { ChatTranscript } from './chat-transcript'
import type { ChatTurn } from './chat-types'

interface SessionMeta {
  workspaceLabel: string
  branchLabel: string
  modeLabel: string
}

interface ChatConversationPaneProps {
  hasActiveThread: boolean
  turns: ChatTurn[]
  inFlightAssistant?: ChatInFlightPresentation | null
  loadingThread: boolean
  sessionMeta: SessionMeta
  /** When set, replaces the transcript (e.g. finalized spec preview). */
  specPreviewPane?: ReactNode
  /** The composer form node (same instance for empty + docked layouts). */
  composer: ReactNode
  suggestions?: string[]
  onPickSuggestion?: (text: string) => void
  addToTaskLabel?: string
  addToTaskAriaLabel?: string
  onAddToTaskTurn?: (turn: ChatTurn) => void
  /** Shown below session meta when agent sandbox mode is active. */
  infoBanner?: ReactNode
  emptyCopyVariant?: ChatEmptyCopyVariant
  hideComposer?: boolean
}

/**
 * Right pane: switches between the empty landing, the live transcript, and the
 * spec preview — and keeps the composer docked at the bottom during a chat.
 * Pure layout; all data + actions arrive via props.
 */
export function ChatConversationPane({
  hasActiveThread,
  turns,
  inFlightAssistant = null,
  loadingThread,
  sessionMeta,
  specPreviewPane,
  composer,
  suggestions,
  onPickSuggestion,
  addToTaskLabel,
  addToTaskAriaLabel,
  onAddToTaskTurn,
  infoBanner,
  emptyCopyVariant = 'default',
  hideComposer = false,
}: ChatConversationPaneProps) {
  if (!hasActiveThread && turns.length === 0 && !loadingThread && !specPreviewPane) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatEmptyState
          suggestions={suggestions}
          onPickSuggestion={onPickSuggestion}
          copyVariant={emptyCopyVariant}
        >
          {composer}
        </ChatEmptyState>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]/70 px-4 py-2 text-xs text-[var(--color-muted)]">
        <GitBranch size={12} aria-hidden />
        <span className="truncate">
          {sessionMeta.branchLabel} · {sessionMeta.workspaceLabel} · {sessionMeta.modeLabel}
        </span>
      </div>

      {infoBanner ? (
        <div
          className="border-b border-[var(--color-border)]/70 bg-[var(--color-panel-strong)]/40 px-4 py-2 text-xs text-[var(--color-muted-strong)]"
          role="status"
        >
          {infoBanner}
        </div>
      ) : null}

      {specPreviewPane ?? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ChatTranscript
            turns={turns}
            inFlightAssistant={inFlightAssistant}
            loading={loadingThread}
            addToTaskLabel={addToTaskLabel}
            addToTaskAriaLabel={addToTaskAriaLabel}
            onAddToTaskTurn={onAddToTaskTurn}
          />
        </div>
      )}

      {specPreviewPane ? null : hideComposer ? null : (
        <div className="border-t border-[var(--color-border)]/60 px-4 py-3">
          <div className="mx-auto w-full max-w-3xl">{composer}</div>
        </div>
      )}
    </div>
  )
}
