import type { AppState, AutoWorkflowDecision, RecentWorkspace } from '@planetz/shared'
import {
  Activity,
  Check,
  FolderOpen,
  LayoutPanelLeft,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  formatLocalizedBootstrapStatusLabel,
  formatLocalizedConnectionLabels,
  useI18n,
} from '../i18n'
import type { ClosablePanelId, PanelVisibility } from '../store/app-store'
import { ProductBrandIcon } from './product-brand-icon'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { StatusDot } from './ui/status-dot'

export interface AppHeaderPanelEntry {
  id: ClosablePanelId
  label: string
}

interface AppHeaderProps {
  state: AppState
  selectedWorkflow?: string
  workflowMode?: 'auto' | 'manual'
  lastAutoDecision?: AutoWorkflowDecision | null
  checkingCli: boolean
  onRecheckCli: () => void
  onOpenSettings: () => void
  onChangeWorkspace: () => void
  recentWorkspaces: RecentWorkspace[]
  onOpenRecentWorkspace: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace: (path: string) => Promise<void>
  onToggleWatch?: () => void
  panelVisibility: PanelVisibility
  panelEntries: ReadonlyArray<AppHeaderPanelEntry>
  onTogglePanel: (id: ClosablePanelId, visible: boolean) => void
  onResetPanels: () => void
}

const BOOTSTRAP_TONE = {
  takt_ready: 'completed',
  partial_takt: 'exceeded',
  non_takt: 'failed',
} as const

export function AppHeader({
  state,
  selectedWorkflow,
  workflowMode = 'manual',
  lastAutoDecision = null,
  checkingCli,
  onRecheckCli,
  onOpenSettings,
  onChangeWorkspace,
  recentWorkspaces,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  onToggleWatch,
  panelVisibility,
  panelEntries,
  onTogglePanel,
  onResetPanels,
}: AppHeaderProps) {
  const { t, locale } = useI18n()
  const { cli, watch } = formatLocalizedConnectionLabels(locale, state.connection)
  const bootstrap = state.workspace.bootstrap
  const cliOk = state.connection.cli === 'ok'
  const watchRunning = state.connection.watch === 'running'
  const watchActionDisabled = !watchRunning && !cliOk
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [workspaceMenuError, setWorkspaceMenuError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef<HTMLDivElement | null>(null)

  function toggleViewMenu() {
    const next = !viewMenuOpen
    setViewMenuOpen(next)
    if (next) {
      setWorkspaceMenuOpen(false)
      setWorkspaceMenuError(null)
    }
  }

  function toggleWorkspaceMenu() {
    const next = !workspaceMenuOpen
    setWorkspaceMenuOpen(next)
    if (next) {
      setViewMenuOpen(false)
    } else {
      setWorkspaceMenuError(null)
    }
  }

  useEffect(() => {
    if (!workspaceMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false)
        setWorkspaceMenuError(null)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWorkspaceMenuOpen(false)
        setWorkspaceMenuError(null)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [workspaceMenuOpen])

  useEffect(() => {
    if (!viewMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!viewMenuRef.current?.contains(event.target as Node)) {
        setViewMenuOpen(false)
      }
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [viewMenuOpen])

  return (
    <header className="relative z-40 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 px-5 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <ProductBrandIcon className="h-7 w-7 rounded-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
            {state.workspace.name}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
            <Badge tone={BOOTSTRAP_TONE[bootstrap]}>
              {formatLocalizedBootstrapStatusLabel(locale, bootstrap)}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <StatusDot
                tone={cliOk ? 'completed' : state.connection.cli === 'ng' ? 'failed' : 'pending'}
              />
              {cli}
            </span>
            <span className="text-[var(--color-muted)]/60">·</span>
            <span className="inline-flex items-center gap-1">
              <StatusDot tone={state.connection.watch === 'running' ? 'running' : 'pending'} />
              {watch}
            </span>
            {workflowMode === 'auto' && lastAutoDecision ? (
              <>
                <span className="text-[var(--color-muted)]/60">·</span>
                <span className="inline-flex items-center gap-1">
                  <Activity size={12} />{' '}
                  {t('composer.headerAutoWorkflow', {
                    workflow: lastAutoDecision.selectedWorkflow,
                  })}
                </span>
              </>
            ) : workflowMode === 'manual' && selectedWorkflow ? (
              <>
                <span className="text-[var(--color-muted)]/60">·</span>
                <span className="inline-flex items-center gap-1">
                  <Activity size={12} /> {selectedWorkflow}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1.5">
        {onToggleWatch ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleWatch}
            disabled={watchActionDisabled}
            title={watchActionDisabled ? t('header.watchDisabledTitle') : undefined}
          >
            {watchRunning ? t('header.stopWatch') : t('header.startWatch')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRecheckCli}
          disabled={checkingCli}
          leading={<RefreshCw size={13} className={checkingCli ? 'animate-spin' : ''} />}
        >
          {checkingCli ? t('header.checkingCli') : t('header.checkCli')}
        </Button>
        <div className="relative" ref={viewMenuRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleViewMenu}
            leading={<LayoutPanelLeft size={13} />}
          >
            {t('header.view')}
          </Button>
          {viewMenuOpen ? (
            <div className="absolute right-0 z-30 mt-1.5 w-[18rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-2xl shadow-black/40">
              {panelEntries.length > 0 ? (
                <>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    {t('header.panelsSection')}
                  </p>
                  <ul>
                    {panelEntries.map((entry) => {
                      const visible = panelVisibility[entry.id]
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => onTogglePanel(entry.id, !visible)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]"
                          >
                            <span>{entry.label}</span>
                            <span className="inline-flex size-4 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
                              {visible ? (
                                <Check size={11} className="text-[var(--color-accent)]" />
                              ) : null}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="mt-1 border-t border-[var(--color-border)]/70 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onResetPanels()
                        setViewMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-muted-strong)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
                    >
                      <RotateCcw size={11} /> {t('header.resetLayout')}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative" ref={wrapperRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleWorkspaceMenu}
            leading={<FolderOpen size={13} />}
          >
            {t('header.workspace')}
          </Button>
          {workspaceMenuOpen ? (
            <div className="absolute right-0 z-30 mt-1.5 w-[28rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2 shadow-2xl shadow-black/40">
              <button
                type="button"
                className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]"
                onClick={() => {
                  setWorkspaceMenuOpen(false)
                  setWorkspaceMenuError(null)
                  onChangeWorkspace()
                }}
              >
                {t('common.openFolder')}
              </button>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {t('common.recentWorkspaces')}
              </p>
              {recentWorkspaces.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-[var(--color-muted)]">
                  {t('common.noRecentWorkspaces')}
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {recentWorkspaces.map((workspace) => (
                    <li key={workspace.path} className="group flex items-center gap-1 px-1">
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]"
                        title={workspace.path}
                        onClick={() => {
                          setWorkspaceMenuError(null)
                          void onOpenRecentWorkspace(workspace.path)
                            .then((switched) => {
                              if (switched) setWorkspaceMenuOpen(false)
                            })
                            .catch((error: unknown) => {
                              const message =
                                error instanceof Error
                                  ? error.message
                                  : t('common.failedToOpenWorkspace')
                              setWorkspaceMenuError(message)
                            })
                        }}
                      >
                        <span className="block truncate">{workspace.path}</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-[11px] text-[var(--color-muted)] opacity-0 transition-opacity hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)] group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => {
                          setWorkspaceMenuError(null)
                          void onRemoveRecentWorkspace(workspace.path).catch((error: unknown) => {
                            const message =
                              error instanceof Error
                                ? error.message
                                : t('common.failedToRemoveWorkspace')
                            setWorkspaceMenuError(message)
                          })
                        }}
                        aria-label={t('common.removeWorkspaceAria', {
                          path: workspace.path,
                        })}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {workspaceMenuError ? (
                <p className="mt-1 px-2 py-1 text-xs text-[var(--color-alert)]">
                  {workspaceMenuError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenSettings}
          leading={<SettingsIcon size={13} />}
        >
          {t('header.settings')}
        </Button>
      </div>
    </header>
  )
}
