import type { KiroSpecSummary } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'

function approvalLabel(
  approved: boolean | undefined,
  labels: { approved: string; pending: string; unknown: string },
): string {
  if (approved === true) return labels.approved
  if (approved === false) return labels.pending
  return labels.unknown
}

export function KiroSpecsPanel() {
  const { t } = useI18n()
  const [specs, setSpecs] = useState<KiroSpecSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.orbit.listKiroSpecs()
      setSpecs(result.specs)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('views.kiroSpecs.loadFailed'))
      setSpecs([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <section className="border-b border-[var(--color-border)] px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
        {t('views.kiroSpecs.title')}
      </h2>
      <p className="mt-1 text-[11px] text-[var(--color-muted)]">
        {t('views.kiroSpecs.description')}
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">{t('views.kiroSpecs.loading')}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-[var(--color-alert)]">{error}</p> : null}
      {!loading && !error && specs.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">{t('views.kiroSpecs.empty')}</p>
      ) : null}
      <ul className="mt-2 space-y-2">
        {specs.map((spec) => (
          <li
            key={spec.featureId}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/60 px-3 py-2 text-xs"
          >
            <p className="font-mono font-medium text-[var(--color-text-strong)]">
              {spec.featureId}
            </p>
            <p className="text-[var(--color-muted)]">{spec.specDirRel}</p>
            {spec.parseStatus !== 'ok' ? (
              <p className="mt-1 text-[var(--color-status-exceeded)]">
                {t(`views.kiroSpecs.parseStatus.${spec.parseStatus}`)}
              </p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-[var(--color-text)]">
                {(['requirements', 'design', 'tasks'] as const).map((phase) => (
                  <li key={phase}>
                    {t(`views.kiroSpecs.phase.${phase}`)}:{' '}
                    {approvalLabel(spec.approvals?.[phase]?.approved, {
                      approved: t('views.kiroSpecs.approved'),
                      pending: t('views.kiroSpecs.pending'),
                      unknown: t('views.kiroSpecs.unknown'),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
