import type { TaskResultBundle } from '@planetz/shared'
import { ExternalLink, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePushToast } from '../../hooks/use-toast'
import { useI18n } from '../../i18n'
import { ReportMarkdownContent } from '../report-markdown-content'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Dialog } from '../ui/dialog'
import { formatReportSourcePath, reportFormatLabel } from './report-format-label'

function resultPathErrorMessage(
  result: { status: string; message?: string },
  fallback: string,
): string {
  if (result.message?.trim()) return result.message.trim()
  if (result.status === 'not_found') return 'Path not found'
  if (result.status === 'denied') return 'Path is outside the allowed workspace'
  return fallback
}

export function TaskResultFullView({
  taskId,
  taskTitle,
  bundle,
  initialIndex,
  onClose,
}: {
  taskId: string
  taskTitle: string
  bundle: TaskResultBundle
  initialIndex: number
  onClose: () => void
}) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const active = bundle.reports[activeIndex]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && activeIndex > 0) setActiveIndex((i) => i - 1)
      if (e.key === 'ArrowRight' && activeIndex < bundle.reports.length - 1) {
        setActiveIndex((i) => i + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, bundle.reports.length])

  if (!active) return null

  const sourcePath = formatReportSourcePath(bundle, active.relativePath)

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(active.content)
    } catch {
      // ignore clipboard failures
    }
  }

  const openResultPath = async (
    action: 'open_report' | 'reveal_reports_dir',
    relativePath?: string,
  ) => {
    try {
      const result = await window.orbit.openTaskResultPath({
        taskId,
        action,
        ...(relativePath ? { relativePath } : {}),
      })
      if (result.status === 'opened') return
      pushToast({
        kind: 'error',
        title: t('panels.result.openPathFailed'),
        message: resultPathErrorMessage(result, t('panels.result.openPathFailed')),
      })
    } catch (error) {
      pushToast({
        kind: 'error',
        title: t('panels.result.openPathFailed'),
        message: error instanceof Error ? error.message : t('panels.result.openPathFailed'),
      })
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      title={t('panels.result.fullTitle', { title: taskTitle })}
      description={bundle.runId ?? bundle.runDirSlug ?? ''}
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {bundle.reports.length > 1 ? (
          <div
            role="tablist"
            aria-label={t('panels.result.reportsTablistAria')}
            className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-5 py-2"
          >
            {bundle.reports.map((r, i) => {
              const isActive = i === activeIndex
              const label = reportFormatLabel(r)
              return (
                <button
                  key={r.fileName}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    isActive
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'text-[var(--color-muted-strong)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
                  )}
                >
                  <span className="font-medium">{label}</span>
                  {r.stepName ? (
                    <span className="text-[10px] text-[var(--color-muted)]">
                      {t('panels.result.stepLabel', { step: r.stepName })}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : null}
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ReportMarkdownContent content={active.content} className="text-sm" />
          {active.truncated ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">{t('panels.result.truncated')}</p>
          ) : null}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-muted)]">
          <span className="font-mono">{sourcePath}</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyMarkdown()}>
              {t('panels.result.copyMarkdown')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leading={<ExternalLink size={12} />}
              onClick={() => void openResultPath('open_report', active.relativePath)}
            >
              {t('panels.result.openInEditor')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leading={<FolderOpen size={12} />}
              onClick={() => void openResultPath('reveal_reports_dir')}
            >
              {t('panels.result.revealReports')}
            </Button>
          </div>
        </footer>
      </div>
    </Dialog>
  )
}
