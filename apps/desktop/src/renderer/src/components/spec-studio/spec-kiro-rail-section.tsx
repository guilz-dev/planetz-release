import type { KiroSpecSummary } from '@planetz/shared'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'

function approvalLabel(
  approved: boolean | undefined,
  labels: { approved: string; pending: string; unknown: string },
): string {
  if (approved === true) return labels.approved
  if (approved === false) return labels.pending
  return labels.unknown
}

interface SpecKiroRailSectionProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SpecKiroRailSection({ open: openProp, onOpenChange }: SpecKiroRailSectionProps) {
  const { t } = useI18n()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const [specs, setSpecs] = useState<KiroSpecSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  useEffect(() => {
    if (isControlled && openProp !== undefined) {
      setInternalOpen(openProp)
    }
  }, [isControlled, openProp])

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
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
          {t('specStudio.phaseTitle')}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-3 py-2 text-xs">
          {loading ? (
            <p className="text-[var(--color-muted)]">{t('views.kiroSpecs.loading')}</p>
          ) : null}
          {error ? <p className="text-[var(--color-alert)]">{error}</p> : null}
          {!loading && specs.length === 0 ? (
            <p className="text-[var(--color-muted)]">{t('views.kiroSpecs.empty')}</p>
          ) : null}
          <ul className="space-y-2">
            {specs.map((spec) => (
              <li
                key={spec.featureId}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-3 py-2"
              >
                <p className="font-mono font-medium text-[var(--color-text-strong)]">
                  {spec.featureId}
                </p>
                {spec.parseStatus === 'ok' ? (
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
                ) : (
                  <p className="mt-1 text-[var(--color-status-exceeded)]">
                    {t(`views.kiroSpecs.parseStatus.${spec.parseStatus}`)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
