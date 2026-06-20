import { useI18n } from '../../i18n/index.js'
import { cn } from '../ui/cn.js'

export function ImplicitEnableBadge({
  workflowName,
  onDismiss,
  className,
}: {
  workflowName: string
  onDismiss: () => void
  className?: string
}) {
  const { t } = useI18n()

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]',
        className,
      )}
    >
      <span>{t('workflowLibrary.implicitBadge')}</span>
      <button
        type="button"
        className="text-[var(--color-accent)] underline-offset-2 hover:underline"
        aria-label={`${t('workflowLibrary.dismissImplicit')}: ${workflowName}`}
        onClick={onDismiss}
      >
        {t('workflowLibrary.dismissImplicit')}
      </button>
    </div>
  )
}
