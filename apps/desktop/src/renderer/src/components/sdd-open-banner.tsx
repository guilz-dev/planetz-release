import type { AppState } from '@planetz/shared'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useI18n } from '../i18n'
import { useAppStore } from '../store/app-store'

interface SddOpenBannerProps {
  sddOpen: NonNullable<AppState['sddOpen']>
}

export function SddOpenBanner({ sddOpen }: SddOpenBannerProps) {
  const { t } = useI18n()
  const setActiveView = useAppStore((store) => store.setActiveView)

  if (sddOpen.recommendedEntry === 'dashboard') return null

  const isSpecStudio = sddOpen.recommendedEntry === 'spec-studio'
  const title = isSpecStudio
    ? t('sddOpen.bannerSpecStudioTitle')
    : t('sddOpen.bannerDecisionsTitle')
  const body = isSpecStudio ? t('sddOpen.bannerSpecStudioBody') : t('sddOpen.bannerDecisionsBody')
  const actionLabel = isSpecStudio ? t('sddOpen.openSpecStudio') : t('sddOpen.openDecisions')

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]/80 px-4 py-2 text-xs">
      <div className="flex min-w-0 items-start gap-2">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">{title}</p>
          <p className="text-[var(--color-muted-strong)]">{body}</p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 font-medium text-[var(--color-text)] hover:bg-[var(--color-panel-strong)]"
        onClick={() => setActiveView(isSpecStudio ? 'spec-studio' : 'decisions')}
      >
        {actionLabel}
        <ArrowRight size={12} aria-hidden />
      </button>
    </div>
  )
}
