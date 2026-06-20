import type {
  StepActivityEntry,
  StepActivityKind,
  TaskExecutionActivityEntry,
} from '@planetz/shared'
import { ArrowDown, Brain, FileEdit, Search, Terminal } from 'lucide-react'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { formatActivityTime } from '../lib/format-activity-time'
import { cn } from './ui/cn'

export type LiveActivityEntry = Pick<
  StepActivityEntry | TaskExecutionActivityEntry,
  'at' | 'kind' | 'text' | 'level'
>

interface LiveActivityLogProps {
  entries: LiveActivityEntry[]
  className?: string
  maxHeightClass?: string
}

export function LiveActivityLog({
  entries,
  className,
  maxHeightClass = 'max-h-56',
}: LiveActivityLogProps) {
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [stickToBottom, setStickToBottom] = useState(true)

  const entryCount = entries.length
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll whenever a new entry arrives
  useLayoutEffect(() => {
    if (!stickToBottom) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entryCount, stickToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handle = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setStickToBottom(distanceFromBottom < 16)
    }
    el.addEventListener('scroll', handle, { passive: true })
    return () => el.removeEventListener('scroll', handle)
  }, [])

  const jumpToLatest = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setStickToBottom(true)
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={t('panels.running.activityLogAria')}
        className={cn(
          'overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-2 py-1.5 text-[11px]',
          maxHeightClass,
        )}
      >
        {entries.length === 0 ? (
          <p className="px-1 py-2 italic text-[var(--color-muted)]">
            {t('panels.running.activityWaiting')}
          </p>
        ) : (
          <ol className="flex flex-col gap-0.5">
            {entries.map((entry, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: activity entries may share timestamps
                key={`${entry.at}-${i}`}
                className="flex items-start gap-1.5 py-0.5 leading-snug"
              >
                <ActivityTime at={entry.at} />
                <ActivityIcon kind={entry.kind} />
                <span
                  className={cn(
                    'min-w-0 flex-1 whitespace-pre-wrap break-words font-mono',
                    entry.level === 'error' && 'text-[var(--color-status-failed)]',
                    entry.level === 'warn' && 'text-[var(--color-status-exceeded)]',
                    !entry.level && 'text-[var(--color-text)]',
                  )}
                >
                  {entry.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {!stickToBottom && entries.length > 0 ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-panel-strong)] px-2 py-0.5 text-[10px] text-[var(--color-text)] shadow-sm hover:bg-[var(--color-surface)]"
          aria-label={t('panels.running.activityJumpToLatest')}
        >
          <ArrowDown size={10} aria-hidden="true" />
          {t('panels.running.activityJumpToLatest')}
        </button>
      ) : null}
    </div>
  )
}

export function ActivityIcon({ kind }: { kind: StepActivityKind | string }): ReactNode {
  const className = 'mt-[3px] shrink-0 text-[var(--color-muted)]'
  switch (kind) {
    case 'read':
      return <Search size={10} className={className} aria-hidden="true" />
    case 'edit':
      return <FileEdit size={10} className={className} aria-hidden="true" />
    case 'tool':
    case 'tool_use':
    case 'tool_output':
    case 'tool_result':
      return <Terminal size={10} className={className} aria-hidden="true" />
    case 'thinking':
      return <Brain size={10} className={className} aria-hidden="true" />
    default:
      return (
        <span
          className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--color-muted)]"
          aria-hidden="true"
        />
      )
  }
}

function ActivityTime({ at }: { at: string }) {
  return (
    <span
      className="shrink-0 self-center font-mono text-[10px] tabular-nums text-[var(--color-muted)]"
      title={at}
    >
      {formatActivityTime(at)}
    </span>
  )
}
