import type { ChatStreamState } from './chat-stream-state'
import { isChatInFlight } from './chat-stream-state'
import type { ChatStreamActivity, ChatStreamingTurn } from './chat-stream-types'

/** Header status for the unified in-flight assistant row. */
export type InFlightChatStatus =
  | 'thinking'
  | 'tool_running'
  | 'responding'
  | 'cancelling'
  | 'retrying'

/** Unified in-flight assistant presentation passed to transcript components. */
export type ChatInFlightPresentation = {
  status: InFlightChatStatus
  streamingTurn: ChatStreamingTurn | null
}

export function shouldShowInFlightAssistantRow(streamState: ChatStreamState): boolean {
  return isChatInFlight(streamState)
}

export function buildInFlightPresentation(
  streamState: ChatStreamState,
  streamingTurn: ChatStreamingTurn | null,
): ChatInFlightPresentation | null {
  if (!shouldShowInFlightAssistantRow(streamState)) return null
  return {
    status: deriveInFlightChatStatus(streamState, streamingTurn),
    streamingTurn,
  }
}

function latestHeaderActivity(
  activities: ChatStreamActivity[],
): Extract<ChatStreamActivity, { kind: 'thinking' | 'tool_use' }> | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index]
    if (activity.kind === 'thinking' || activity.kind === 'tool_use') {
      return activity
    }
  }
  return null
}

/** Derives the single-line header status from stream lifecycle + live partial turn. */
export function deriveInFlightChatStatus(
  streamState: ChatStreamState,
  streamingTurn: ChatStreamingTurn | null,
): InFlightChatStatus {
  if (streamState === 'retrying') return 'retrying'
  if (streamState === 'cancelling') return 'cancelling'

  const text = streamingTurn?.text ?? ''
  if (text.trim().length > 0) return 'responding'

  const latest = latestHeaderActivity(streamingTurn?.activities ?? [])
  if (latest?.kind === 'tool_use') return 'tool_running'
  return 'thinking'
}

export function latestToolUseForHeader(
  streamingTurn: ChatStreamingTurn | null,
): Extract<ChatStreamActivity, { kind: 'tool_use' }> | null {
  const latest = latestHeaderActivity(streamingTurn?.activities ?? [])
  return latest?.kind === 'tool_use' ? latest : null
}
