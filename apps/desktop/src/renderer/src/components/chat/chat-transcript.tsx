import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../i18n'
import type { ChatInFlightPresentation } from '../../lib/in-flight-chat-status'
import { ChatInFlightAssistantRow } from './chat-in-flight-assistant-row'
import { ChatMessageActions } from './chat-message-actions'
import { ChatTranscriptVirtual, shouldVirtualizeChatTranscript } from './chat-transcript-virtual'
import { ChatTurnContent } from './chat-turn-content'
import type { ChatTurn } from './chat-types'

interface ChatTranscriptProps {
  turns: ChatTurn[]
  inFlightAssistant?: ChatInFlightPresentation | null
  loading?: boolean
  addToTaskLabel?: string
  addToTaskAriaLabel?: string
  onAddToTaskTurn?: (turn: ChatTurn) => void
}

/** Scrollable message list. Presentational: receives turns, renders bubbles. */
export function ChatTranscript({
  turns,
  inFlightAssistant = null,
  loading = false,
  addToTaskLabel,
  addToTaskAriaLabel,
  onAddToTaskTurn,
}: ChatTranscriptProps) {
  const { t } = useI18n()
  const endRef = useRef<HTMLDivElement | null>(null)
  const latestAssistantTurnId =
    [...turns].reverse().find((turn) => turn.role === 'assistant')?.id ?? null

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on new turn / reply state
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [
    turns.length,
    inFlightAssistant?.status,
    inFlightAssistant?.streamingTurn?.text,
    inFlightAssistant?.streamingTurn?.activities.length,
  ])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2
          size={20}
          aria-label={t('chat.loadingThread')}
          className="animate-spin text-[var(--color-accent)] motion-reduce:animate-none"
        />
      </div>
    )
  }

  if (shouldVirtualizeChatTranscript(turns.length)) {
    return (
      <div
        role="log"
        aria-live="polite"
        aria-label={t('chat.transcriptAria')}
        className="mx-auto h-full w-full max-w-3xl"
      >
        <ChatTranscriptVirtual
          turns={turns}
          inFlightAssistant={inFlightAssistant}
          latestAssistantTurnId={latestAssistantTurnId}
          addToTaskLabel={addToTaskLabel}
          addToTaskAriaLabel={addToTaskAriaLabel}
          onAddToTaskTurn={onAddToTaskTurn}
        />
      </div>
    )
  }

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label={t('chat.transcriptAria')}
      className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6"
    >
      {turns.map((turn) => (
        <ChatMessage
          key={turn.id}
          turn={turn}
          youLabel={t('chat.you')}
          addToTaskLabel={addToTaskLabel}
          addToTaskAriaLabel={addToTaskAriaLabel}
          onAddToTaskTurn={onAddToTaskTurn}
          showAddToTask={Boolean(
            latestAssistantTurnId &&
              turn.role === 'assistant' &&
              turn.id === latestAssistantTurnId &&
              onAddToTaskTurn &&
              addToTaskLabel,
          )}
        />
      ))}
      {inFlightAssistant ? (
        <ChatInFlightAssistantRow
          streamingTurn={inFlightAssistant.streamingTurn}
          inFlightStatus={inFlightAssistant.status}
        />
      ) : null}
      <div ref={endRef} />
    </div>
  )
}

function ChatMessage({
  turn,
  youLabel,
  showAddToTask,
  addToTaskLabel,
  addToTaskAriaLabel,
  onAddToTaskTurn,
}: {
  turn: ChatTurn
  youLabel: string
  showAddToTask: boolean
  addToTaskLabel?: string
  addToTaskAriaLabel?: string
  onAddToTaskTurn?: (turn: ChatTurn) => void
}) {
  return (
    <div className="group flex flex-col gap-1">
      <ChatTurnContent turn={turn} youLabel={youLabel} />
      <ChatMessageActions
        turn={turn}
        align={turn.role === 'user' ? 'end' : 'start'}
        showAddToTask={showAddToTask}
        addToTaskLabel={addToTaskLabel}
        addToTaskAriaLabel={addToTaskAriaLabel}
        onAddToTaskTurn={onAddToTaskTurn}
      />
    </div>
  )
}
