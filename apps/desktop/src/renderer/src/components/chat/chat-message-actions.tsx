import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n'
import { ChatAddToTaskButton } from './chat-add-to-task-button'
import type { ChatTurn } from './chat-types'

/** Local HH:MM formatter; returns '' for unparseable timestamps. */
function formatTurnTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

interface ChatMessageActionsProps {
  turn: ChatTurn
  /** Toolbar alignment: assistant replies left, user messages right. */
  align?: 'start' | 'end'
  /** Show the "Add to task" hand-off link (latest assistant turn only). */
  showAddToTask?: boolean
  addToTaskLabel?: string
  addToTaskAriaLabel?: string
  onAddToTaskTurn?: (turn: ChatTurn) => void
}

/**
 * Per-message hover toolbar: clipboard copy, optional "Add to task" link, and
 * the time the message was recorded. Hidden until the message row is hovered or
 * a child receives keyboard focus (the parent must carry the `group` class).
 */
export function ChatMessageActions({
  turn,
  align = 'start',
  showAddToTask = false,
  addToTaskLabel,
  addToTaskAriaLabel,
  onAddToTaskTurn,
}: ChatMessageActionsProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const time = formatTurnTime(turn.createdAt)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(turn.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <div
      className={`flex items-center gap-1.5 text-[var(--color-muted)] opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none ${
        align === 'end' ? 'justify-end' : 'justify-start'
      }`}
    >
      <button
        type="button"
        title={copied ? t('chat.copied') : t('chat.copyMessage')}
        aria-label={copied ? t('chat.copied') : t('chat.copyMessage')}
        onClick={handleCopy}
        className="rounded p-1 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text)]"
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      </button>
      {showAddToTask ? (
        <ChatAddToTaskButton
          label={addToTaskLabel ?? ''}
          ariaLabel={addToTaskAriaLabel}
          onClick={() => onAddToTaskTurn?.(turn)}
        />
      ) : null}
      {time ? <span className="px-0.5 text-[10px] tabular-nums">{time}</span> : null}
    </div>
  )
}
