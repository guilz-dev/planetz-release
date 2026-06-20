import type { WorkspaceBootstrapStatus } from '@planetz/shared'
import { ORBIT_DISPLAY_NAME, ORBIT_DISPLAY_ROOT } from '@planetz/shared'
import { AlertTriangle, Wrench } from 'lucide-react'
import { useI18n } from '../i18n'

interface WorkspaceBootstrapBannerProps {
  status: WorkspaceBootstrapStatus
}

export function WorkspaceBootstrapBanner({ status }: WorkspaceBootstrapBannerProps) {
  const { t } = useI18n()

  // Orbit-ready status is shown in the app header; avoid a duplicate banner row.
  if (status === 'takt_ready') {
    return null
  }

  const partial = status === 'partial_takt'
  const tone = partial
    ? 'border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)] text-[var(--color-status-exceeded)]'
    : 'border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)]'
  const icon = partial ? <Wrench size={14} /> : <AlertTriangle size={14} />
  const title = partial
    ? t('bootstrap.partialTitle', { root: ORBIT_DISPLAY_ROOT })
    : t('bootstrap.nonTaktTitle', { orbit: ORBIT_DISPLAY_NAME })
  const body = partial
    ? t('bootstrap.partialBody', { orbit: ORBIT_DISPLAY_NAME })
    : t('bootstrap.nonTaktBody')

  return (
    <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${tone}`}>
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">{title}</p>
          <p className="text-[var(--color-muted-strong)]">{body}</p>
        </div>
      </div>
    </div>
  )
}
