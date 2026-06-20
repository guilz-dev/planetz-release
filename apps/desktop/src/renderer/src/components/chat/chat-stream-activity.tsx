import { Loader2, Wrench } from 'lucide-react'
import type { I18nKey } from '../../i18n'
import { useI18n } from '../../i18n'
import { type ChatStreamActivity, streamActivityKey } from '../../lib/chat-stream-types'

export function ChatStreamActivityList({ activities }: { activities: ChatStreamActivity[] }) {
  const { t } = useI18n()
  if (activities.length === 0) return null

  return (
    <ul className="flex flex-col gap-1.5 border-l-2 border-[var(--color-border)]/80 pl-3 text-xs text-[var(--color-muted)]">
      {activities.map((activity, index) => (
        <li key={streamActivityKey(activity, index)} className="flex flex-col gap-0.5">
          <ChatStreamActivityRow activity={activity} t={t} />
        </li>
      ))}
    </ul>
  )
}

function ChatStreamActivityRow({
  activity,
  t,
}: {
  activity: ChatStreamActivity
  t: (key: I18nKey, params?: Record<string, string>) => string
}) {
  switch (activity.kind) {
    case 'thinking':
      return (
        <span className="flex items-start gap-1.5 italic">
          <Loader2
            size={12}
            className="mt-0.5 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          {t('chat.stream.thinking')}
          {activity.text.trim() ? (
            <span className="not-italic opacity-80">{activity.text.trim().slice(0, 120)}</span>
          ) : null}
        </span>
      )
    case 'tool_use':
      return (
        <span className="flex items-center gap-1.5">
          <Wrench size={12} aria-hidden className="shrink-0" />
          {activity.mcpServerId && activity.mcpToolName
            ? t('chat.stream.mcpToolRunning', {
                server: activity.mcpServerId,
                tool: activity.mcpToolName,
              })
            : t('chat.stream.toolRunning', { tool: activity.tool })}
        </span>
      )
    case 'tool_output':
      return (
        <span className="whitespace-pre-wrap font-mono text-[10px] opacity-90">
          {t('chat.stream.toolOutput', { tool: activity.tool })}
          {activity.output.trim() ? `\n${activity.output.trim().slice(0, 200)}` : ''}
        </span>
      )
    case 'tool_result':
      return (
        <span className={activity.isError ? 'text-[var(--color-danger)]' : undefined}>
          {activity.isError ? t('chat.stream.toolError') : t('chat.stream.toolResult')}
          {activity.content.trim() ? `: ${activity.content.trim().slice(0, 120)}` : ''}
        </span>
      )
    case 'rate_limit':
      return <span>{t('chat.stream.rateLimit', { status: activity.status })}</span>
    case 'error':
      return <span className="text-[var(--color-danger)]">{activity.message}</span>
    default:
      return null
  }
}
