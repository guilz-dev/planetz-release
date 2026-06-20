import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { formatWorkspaceTabLabel } from '../lib/workspace-tab-labels'
import type { WorkspaceUiTab } from '../lib/workspace-ui-tab'
import { cn } from './ui/cn'

export interface WorkspaceTabStripProps {
  tabs: ReadonlyArray<WorkspaceUiTab>
  activePath: string
  workspaceSwitching: boolean
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function WorkspaceTabStrip({
  tabs,
  activePath,
  workspaceSwitching,
  onSelect,
  onClose,
}: WorkspaceTabStripProps) {
  const { t } = useI18n()
  const activeTabRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!activePath) return
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activePath])

  if (tabs.length < 2) return null

  return (
    <nav
      aria-label={t('workspaceTabs.stripAria')}
      aria-busy={workspaceSwitching}
      className={cn(
        'flex h-8 shrink-0 items-stretch justify-end border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 px-2',
        workspaceSwitching && 'pointer-events-none opacity-60',
      )}
    >
      <ul className="flex min-w-0 items-stretch overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.path === activePath
          const label = formatWorkspaceTabLabel(tab, tabs)
          return (
            <li
              key={tab.path}
              ref={active ? activeTabRef : undefined}
              className="group/tab shrink-0 self-stretch"
            >
              <div
                className={cn(
                  // -mb-px lets the active underline sit on top of the strip's bottom border
                  'flex h-full items-center border-b-2 text-[11px] transition-colors -mb-px',
                  active
                    ? 'border-[var(--color-accent)] text-[var(--color-text-strong)]'
                    : 'border-transparent text-[var(--color-muted-strong)] hover:bg-[var(--color-panel)]/50 hover:text-[var(--color-text-strong)]',
                )}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={workspaceSwitching}
                  title={tab.path}
                  onClick={() => onSelect(tab.path)}
                  className="max-w-[12rem] truncate py-1 pl-2.5 pr-1.5 font-medium"
                >
                  {label}
                </button>
                <button
                  type="button"
                  disabled={workspaceSwitching}
                  aria-label={t('workspaceTabs.closeAria', { name: label })}
                  title={t('workspaceTabs.closeAria', { name: label })}
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(tab.path)
                  }}
                  className={cn(
                    'mr-1 inline-flex shrink-0 rounded p-0.5 text-[var(--color-muted)] transition-opacity hover:bg-[var(--color-panel)] hover:text-[var(--color-text-strong)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]',
                    active
                      ? 'opacity-100'
                      : 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100',
                  )}
                >
                  <X size={11} aria-hidden />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
