import { isDeprecatedBuiltinWorkflow, resolveWorkflowRetirementSignal } from '@planetz/shared'
import { useI18n } from '../../i18n/index.js'
import { Badge } from '../ui/badge.js'

export function WorkflowFamilyBadges({ workflowName }: { workflowName: string }) {
  const { t } = useI18n()
  const signal = resolveWorkflowRetirementSignal(workflowName)
  const deprecated = isDeprecatedBuiltinWorkflow(workflowName)

  if (signal === 'none' && !deprecated) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {deprecated ? (
        <Badge tone="pending">{t('settings.workflowCatalog.badgeDeprecated')}</Badge>
      ) : null}
      {signal === 'experimental' ? (
        <Badge tone="accent">{t('settings.workflowCatalog.badgeExperimental')}</Badge>
      ) : null}
      {signal === 'consolidation_candidate' ? (
        <Badge tone="neutral">{t('settings.workflowCatalog.badgeConsolidationCandidate')}</Badge>
      ) : null}
    </span>
  )
}
