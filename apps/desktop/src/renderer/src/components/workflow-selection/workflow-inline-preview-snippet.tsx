import type { WorkflowPreviewResult } from '@planetz/shared'
import { Loader2 } from 'lucide-react'
import { useI18n } from '../../i18n/index.js'
import { WorkflowFeatureBadges } from './workflow-feature-badges.js'

export function WorkflowInlinePreviewSnippet({
  preview,
  loading,
  loadError,
}: {
  preview: WorkflowPreviewResult | null
  loading: boolean
  loadError: boolean
}) {
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[10px] text-[var(--color-muted)]">
        <Loader2 size={10} className="animate-spin" />
        {t('composer.workflowPicker.loading')}
      </div>
    )
  }

  if (loadError) {
    return (
      <p className="px-3 pb-1.5 text-[10px] text-[var(--color-status-failed)]">
        {t('composer.workflowPicker.loadError')}
      </p>
    )
  }

  if (!preview) return null

  return (
    <div className="flex flex-col gap-1 px-3 pb-1.5">
      <WorkflowFeatureBadges preview={preview} />
      <p className="text-[10px] text-[var(--color-muted)]">
        {t('composer.workflowPicker.steps', { count: String(preview.steps.length) })}
      </p>
    </div>
  )
}
