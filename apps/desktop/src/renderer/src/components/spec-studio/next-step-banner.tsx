import type { SpecThreadSummary, SpecWorkbenchPhase } from '@planetz/shared'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'

export interface NextStepBannerLabels {
  clarifyTitle: string
  decideTitle: string
  decideAction: string
  traceTitle: string
  traceAction: string
  driftTitle: string
  driftBody: string
  driftAction: string
}

export interface NextStepBannerProps {
  summary: SpecThreadSummary | null
  workbenchPhase: SpecWorkbenchPhase
  labels: NextStepBannerLabels
  onSelectPhase: (phase: SpecWorkbenchPhase) => void
  onHighlightDrift?: () => void
}

export function NextStepBanner({
  summary,
  workbenchPhase,
  labels,
  onSelectPhase,
  onHighlightDrift,
}: NextStepBannerProps) {
  if (!summary) return null

  const { hasDecidedIntent, taskCount, driftCount, phase } = summary
  const isDrift = driftCount > 0 || phase === 'drift'

  if (isDrift) {
    return (
      <div
        className={cn(
          'border-b px-4 py-2 text-xs',
          'border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)]/40 text-[var(--color-status-exceeded)]',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{labels.driftTitle}</p>
            <p className="mt-0.5 opacity-90">{labels.driftBody}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              onSelectPhase('trace')
              onHighlightDrift?.()
            }}
          >
            {labels.driftAction}
          </Button>
        </div>
      </div>
    )
  }

  if (!hasDecidedIntent) {
    if (workbenchPhase === 'clarify') {
      return (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-4 py-2 text-xs text-[var(--color-muted-strong)]">
          <p>{labels.clarifyTitle}</p>
        </div>
      )
    }
    return null
  }

  if (taskCount === 0 && workbenchPhase === 'clarify') {
    return (
      <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-4 py-2 text-xs text-[var(--color-muted-strong)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{labels.decideTitle}</p>
          <Button type="button" size="sm" variant="subtle" onClick={() => onSelectPhase('decide')}>
            {labels.decideAction}
          </Button>
        </div>
      </div>
    )
  }

  if (taskCount > 0 && workbenchPhase !== 'trace') {
    return (
      <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-4 py-2 text-xs text-[var(--color-muted-strong)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{labels.traceTitle}</p>
          <Button type="button" size="sm" variant="subtle" onClick={() => onSelectPhase('trace')}>
            {labels.traceAction}
          </Button>
        </div>
      </div>
    )
  }

  return null
}
