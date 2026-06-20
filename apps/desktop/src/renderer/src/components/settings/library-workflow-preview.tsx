import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useWorkflowPreview } from '../../hooks/use-workflow-preview.js'
import { useI18n } from '../../i18n/index.js'
import { Button } from '../ui/button.js'
import { WorkflowFeatureBadges } from '../workflow-selection/workflow-feature-badges.js'

export function LibraryWorkflowPreview({ workflowName }: { workflowName: string }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const { preview, loading, loadError } = useWorkflowPreview(workflowName, expanded)

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" onClick={() => setExpanded((open) => !open)}>
        {expanded
          ? t('settings.workflowCatalog.hidePreview')
          : t('settings.workflowCatalog.preview')}
      </Button>
      {expanded && loading ? (
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          <Loader2 size={12} className="animate-spin" />
          {t('settings.workflowCatalog.previewLoading')}
        </div>
      ) : null}
      {expanded && loadError ? (
        <p className="text-[11px] text-[var(--color-status-failed)]">
          {t('settings.workflowCatalog.previewError')}
        </p>
      ) : null}
      {expanded && preview ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2">
          {preview.description ? (
            <p className="text-[11px] text-[var(--color-muted-strong)]">{preview.description}</p>
          ) : null}
          <WorkflowFeatureBadges preview={preview} />
        </div>
      ) : null}
    </div>
  )
}
