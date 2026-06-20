import type { ConversationEntry } from '@planetz/shared'
import { useEffect, useState } from 'react'

interface ConversationTimelineProps {
  taskId: string
}

export function ConversationTimeline({ taskId }: ConversationTimelineProps) {
  const [entries, setEntries] = useState<ConversationEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.orbit
      .listConversationsForTask({ taskId })
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  if (error) {
    return <p className="text-xs text-[var(--color-status-failed)]">{error}</p>
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        No conversation entries for this task yet.
      </p>
    )
  }

  return (
    <ul className="max-h-36 space-y-2 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-2 py-1.5"
        >
          <div className="mb-0.5 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span className="uppercase">{entry.kind}</span>
            <span>{entry.role}</span>
          </div>
          <p className="text-xs whitespace-pre-wrap text-[var(--color-text)]">{entry.body}</p>
        </li>
      ))}
    </ul>
  )
}
