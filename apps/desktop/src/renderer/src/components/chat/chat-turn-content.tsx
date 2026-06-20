import type { ChatStreamingTurn } from '../../lib/chat-stream-types'
import type { InFlightChatStatus } from '../../lib/in-flight-chat-status'
import { ReportMarkdownContent } from '../report-markdown-content'
import { ChatInFlightStatusHeader } from './chat-in-flight-status-header'
import { ChatStreamActivityList } from './chat-stream-activity'
import type { ChatTurn } from './chat-types'

export function ChatTurnContent({
  turn,
  youLabel,
  streamingTurn = null,
  inFlightStatus = null,
}: {
  turn: ChatTurn
  youLabel: string
  streamingTurn?: ChatStreamingTurn | null
  inFlightStatus?: InFlightChatStatus | null
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[var(--color-accent-soft)] px-3.5 py-2 text-[14px] text-[var(--color-text)]">
          {turn.content}
        </div>
        <span className="px-1 text-[10px] text-[var(--color-muted)]">{youLabel}</span>
      </div>
    )
  }

  const content = streamingTurn?.text ?? turn.content
  const activities = streamingTurn?.activities ?? []

  return (
    <div className="flex w-full flex-col gap-2">
      {inFlightStatus ? (
        <ChatInFlightStatusHeader inFlightStatus={inFlightStatus} streamingTurn={streamingTurn} />
      ) : null}
      {content.trim() ? (
        <ReportMarkdownContent
          content={content}
          size="comfortable"
          className="leading-relaxed text-[var(--color-text)]"
        />
      ) : null}
      <ChatStreamActivityList activities={activities} />
    </div>
  )
}
