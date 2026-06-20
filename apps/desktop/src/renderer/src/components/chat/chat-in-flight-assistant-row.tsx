import type { ChatStreamingTurn } from '../../lib/chat-stream-types'
import type { InFlightChatStatus } from '../../lib/in-flight-chat-status'
import { ChatTurnContent } from './chat-turn-content'

interface ChatInFlightAssistantRowProps {
  streamingTurn: ChatStreamingTurn | null
  inFlightStatus: InFlightChatStatus
}

/** Unified assistant row shown from send start through stream completion. */
export function ChatInFlightAssistantRow({
  streamingTurn,
  inFlightStatus,
}: ChatInFlightAssistantRowProps) {
  return (
    <ChatTurnContent
      turn={{
        id: streamingTurn?.id ?? 'in-flight',
        role: 'assistant',
        content: streamingTurn?.text ?? '',
        createdAt: new Date().toISOString(),
      }}
      youLabel=""
      streamingTurn={streamingTurn}
      inFlightStatus={inFlightStatus}
    />
  )
}
