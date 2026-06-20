import { PanelLeftClose, Plus, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../../i18n'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import type { ChatThreadSummary } from './chat-types'

interface ChatHistorySidebarProps {
  threads: ChatThreadSummary[]
  activeThreadId: string | null
  searchQuery: string
  onSearchChange: (value: string) => void
  onNewChat: () => void
  onSelectThread: (threadId: string) => void
  onCollapse: () => void
  /** Workspace path to surface first (current workspace). */
  currentWorkspacePath?: string
  loading?: boolean
}

interface WorkspaceGroup {
  path: string
  label: string
  threads: ChatThreadSummary[]
}

function groupThreads(
  threads: ChatThreadSummary[],
  currentWorkspacePath?: string,
): WorkspaceGroup[] {
  const byPath = new Map<string, WorkspaceGroup>()
  for (const thread of threads) {
    const group = byPath.get(thread.workspacePath)
    if (group) {
      group.threads.push(thread)
    } else {
      byPath.set(thread.workspacePath, {
        path: thread.workspacePath,
        label: thread.workspaceLabel,
        threads: [thread],
      })
    }
  }
  const groups = [...byPath.values()]
  // Current workspace first, then the rest as-is.
  groups.sort((a, b) => {
    if (a.path === currentWorkspacePath) return -1
    if (b.path === currentWorkspacePath) return 1
    return 0
  })
  return groups
}

/** Left rail: new chat, search, workspace-grouped history. Presentational. */
export function ChatHistorySidebar({
  threads,
  activeThreadId,
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectThread,
  onCollapse,
  currentWorkspacePath,
  loading = false,
}: ChatHistorySidebarProps) {
  const { t } = useI18n()

  const groups = useMemo(
    () => groupThreads(threads, currentWorkspacePath),
    [threads, currentWorkspacePath],
  )

  return (
    <aside className="flex w-[272px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40">
      <div className="flex items-center gap-1.5 p-2.5">
        <Button
          variant="secondary"
          size="sm"
          leading={<Plus size={14} />}
          className="flex-1 justify-start border-transparent"
          onClick={onNewChat}
        >
          {t('chat.newChat')}
        </Button>
        <button
          type="button"
          aria-label={t('chat.collapseSidebar')}
          onClick={onCollapse}
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="px-2.5 pb-2">
        <span className="relative flex items-center">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-2.5 text-[var(--color-muted)]"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('chat.searchPlaceholder')}
            className="focus-ring h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
          />
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <p className="px-2 py-3 text-xs text-[var(--color-muted)]">{t('chat.loadingThreads')}</p>
        ) : groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--color-muted)]">
            {searchQuery.trim() ? t('chat.noSearchResults') : t('chat.noThreads')}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.path} className="mb-3">
              <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {group.threads.map((thread) => {
                  const active = thread.id === activeThreadId
                  return (
                    <li key={thread.id}>
                      <button
                        type="button"
                        onClick={() => onSelectThread(thread.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          active
                            ? 'bg-[var(--color-panel-strong)] text-[var(--color-text-strong)]'
                            : 'text-[var(--color-muted-strong)] hover:bg-[var(--color-panel)] hover:text-[var(--color-text)]',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            thread.hasActiveSession ? 'bg-[var(--color-accent)]' : 'bg-transparent',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {thread.title.length > 0 ? thread.title : t('chat.untitledConversation')}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </aside>
  )
}
