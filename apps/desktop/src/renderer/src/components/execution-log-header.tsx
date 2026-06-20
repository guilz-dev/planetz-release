import { useI18n } from '../i18n'

interface ExecutionLogHeaderProps {
  resultSummary?: string
}

export function ExecutionLogHeader({ resultSummary }: ExecutionLogHeaderProps) {
  const { t } = useI18n()
  return (
    <header className="flex flex-col gap-2 border-b border-[var(--color-border)]/70 px-3 py-2">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-strong)]">
          {t('views.log.title')}
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{t('views.log.description')}</p>
      </div>
      {resultSummary ? (
        <p className="text-[10px] text-[var(--color-muted)]">{resultSummary}</p>
      ) : null}
    </header>
  )
}
