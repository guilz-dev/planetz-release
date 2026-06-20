import { Loader2 } from 'lucide-react'
import type { I18nKey } from '../../i18n'
import { useI18n } from '../../i18n'
import type { ChatStreamingTurn } from '../../lib/chat-stream-types'
import { type InFlightChatStatus, latestToolUseForHeader } from '../../lib/in-flight-chat-status'

function inFlightStatusLabel(
  t: (key: I18nKey, params?: Record<string, string>) => string,
  status: InFlightChatStatus,
  streamingTurn: ChatStreamingTurn | null,
): string {
  switch (status) {
    case 'responding':
      return t('chat.stream.responding')
    case 'cancelling':
      return t('chat.stream.cancelling')
    case 'retrying':
      return t('chat.stream.retrying')
    case 'tool_running': {
      const toolUse = latestToolUseForHeader(streamingTurn)
      if (toolUse?.mcpServerId && toolUse.mcpToolName) {
        return t('chat.stream.mcpToolRunning', {
          server: toolUse.mcpServerId,
          tool: toolUse.mcpToolName,
        })
      }
      return t('chat.stream.toolRunning', { tool: toolUse?.tool ?? 'tool' })
    }
    case 'thinking':
      return t('chat.stream.thinking')
    default:
      return t('chat.stream.thinking')
  }
}

export function ChatInFlightStatusHeader({
  inFlightStatus,
  streamingTurn,
}: {
  inFlightStatus: InFlightChatStatus
  streamingTurn: ChatStreamingTurn | null
}) {
  const { t } = useI18n()
  const showSpinner =
    inFlightStatus === 'thinking' ||
    inFlightStatus === 'tool_running' ||
    inFlightStatus === 'cancelling' ||
    inFlightStatus === 'retrying'

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]"
      role="status"
      aria-live="polite"
    >
      {showSpinner ? (
        <Loader2
          size={13}
          className="shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      ) : null}
      <span>{inFlightStatusLabel(t, inFlightStatus, streamingTurn)}</span>
    </div>
  )
}
