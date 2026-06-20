import type { AgentState, ExecutorState, IntegrationsState } from '@planetz/shared'
import { EXECUTOR_ID_CLAUDE, EXECUTOR_ID_CODEX, EXECUTOR_ID_CURSOR } from '@planetz/shared'
import { Plug, Settings } from 'lucide-react'
import { useI18n } from '../i18n'
import { formatActivityTime } from '../lib/format-activity-time'
import { StatusDot } from './ui/status-dot'

interface AdapterViewProps {
  agents: AgentState[]
  executors: ExecutorState[]
  integrations: IntegrationsState
  onOpenSettings?: () => void
}

const EXECUTOR_ID_BY_ADAPTER = {
  cursor: EXECUTOR_ID_CURSOR,
  codex: EXECUTOR_ID_CODEX,
  claude: EXECUTOR_ID_CLAUDE,
} as const

export function AdapterView({ agents, executors, integrations, onOpenSettings }: AdapterViewProps) {
  const { t } = useI18n()

  const columns = integrations.adapters.map((adapter) => {
    const executorId = EXECUTOR_ID_BY_ADAPTER[adapter.id]
    const executor = executors.find((e) => e.id === executorId)
    const agent = agents.find((a) => a.id === executorId)
    const events = [...(agent?.logTail ?? [])].reverse().map((entry, index) => ({
      id: `${entry.at}-${index}`,
      at: formatActivityTime(entry.at),
      label: entry.message,
    }))
    return { adapter, executor, events }
  })

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-strong)]">
            {t('views.adapter.title')}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {t('views.adapter.description')}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
          <span>
            {t('views.adapter.hookServer', {
              status: integrations.hookServer.enabled
                ? t('views.adapter.statusEnabled')
                : t('views.adapter.statusDisabled'),
              port: integrations.hookServer.port,
            })}
          </span>
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-2 py-1 text-[11px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text-strong)]"
            >
              <Settings size={11} />
              {t('views.adapter.openSettings')}
            </button>
          ) : null}
        </div>
      </header>

      <div
        className="grid min-h-0 flex-1 gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}
      >
        {columns.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--color-muted)]">
            {t('views.adapter.noAdaptersConfigured')}
          </p>
        ) : (
          columns.map(({ adapter, executor, events }) => (
            <article
              key={adapter.id}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/60"
            >
              <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/70 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Plug size={11} className="text-[var(--color-muted)]" />
                  <h3 className="truncate text-sm font-medium text-[var(--color-text)]">
                    {adapter.displayName}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                  <StatusDot
                    tone={
                      adapter.enabled
                        ? executor && executor.status === 'working'
                          ? 'working'
                          : 'completed'
                        : 'neutral'
                    }
                  />
                  {adapter.enabled
                    ? t('views.adapter.statusEnabled')
                    : t('views.adapter.statusDisabled')}
                </span>
              </header>
              <div className="border-b border-[var(--color-border)]/40 px-3 py-2 text-[11px] text-[var(--color-muted)]">
                <p>
                  {t('views.adapter.hookState', {
                    state:
                      adapter.enabled && integrations.hookServer.enabled
                        ? t('views.adapter.hookOk')
                        : t('views.adapter.hookUnavailable'),
                  })}
                </p>
                <p className="mt-0.5">
                  {t('views.adapter.activeTasks', {
                    count: executor ? executor.activeTaskIds.length : 0,
                  })}
                </p>
              </div>
              <ul className="flex-1 divide-y divide-[var(--color-border)]/40 overflow-auto">
                {events.length === 0 ? (
                  <li className="px-3 py-3 text-[11px] text-[var(--color-muted)]">
                    {t('views.adapter.noActivity')}
                  </li>
                ) : (
                  events.map((event) => (
                    <li
                      key={`${adapter.id}-${event.id}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--color-text)]"
                    >
                      <span className="w-14 shrink-0 font-mono text-[var(--color-muted)]">
                        {event.at}
                      </span>
                      <span className="min-w-0 truncate">{event.label}</span>
                    </li>
                  ))
                )}
              </ul>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
