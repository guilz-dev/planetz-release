import { FileText } from 'lucide-react'
import { useI18n } from '../../i18n'
import { cn } from '../ui/cn'

export function TaskResultFrame({
  title,
  accent,
  warning,
  actions,
  children,
  footer,
}: {
  title: string
  accent: boolean
  warning?: boolean
  actions: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <section
      aria-label={t('panels.result.regionAria')}
      className={cn(
        'rounded-md border p-3',
        warning
          ? 'border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/20'
          : accent
            ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]/30 shadow-sm shadow-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]/40',
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FileText
            size={12}
            className={
              warning
                ? 'text-[var(--color-status-failed)]'
                : accent
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-muted)]'
            }
          />
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              accent
                ? 'text-[var(--color-accent)]'
                : warning
                  ? 'text-[var(--color-status-failed)]'
                  : 'text-[var(--color-muted-strong)]',
            )}
          >
            {title}
          </p>
        </div>
        {actions}
      </header>
      {children}
      {footer}
    </section>
  )
}
