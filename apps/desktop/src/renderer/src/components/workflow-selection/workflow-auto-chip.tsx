import { type AutoWorkflowDecision, ROUTING_REASON_CODES } from '@planetz/shared'
import { AlertTriangle, ChevronDown, Loader2, Sparkles, Zap } from 'lucide-react'
import { useState } from 'react'
import type {
  WorkflowAutoPreviewPhase,
  WorkflowAutoPreviewRationale,
} from '../../hooks/use-workflow-auto-preview.js'
import { useI18n } from '../../i18n/index.js'
import { cn } from '../ui/cn.js'
import { Popover, PopoverAnchor } from '../ui/popover.js'

function normalizeDecisionReason(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function AutoPreviewRationaleBlock({
  rationale,
  t,
}: {
  rationale: WorkflowAutoPreviewRationale
  t: ReturnType<typeof useI18n>['t']
}) {
  const decisionReason = normalizeDecisionReason(rationale.decisionReason)
  const hasDecisionReason = decisionReason.length > 0
  const hasComparedDifferences = rationale.comparedDifferences.length > 0
  const isSingleCandidate = rationale.reasonCodes.includes(
    ROUTING_REASON_CODES.routing.singleCandidate,
  )
  const showReasonCodes =
    !hasDecisionReason &&
    !hasComparedDifferences &&
    !isSingleCandidate &&
    rationale.reasonCodes.length > 0

  return (
    <div className="mt-2 max-h-40 overflow-auto border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-muted-strong)]">
      {rationale.fallbackApplied ? (
        <p className="mb-2 inline-flex items-center gap-1 text-[var(--color-status-failed)]">
          <AlertTriangle size={11} />
          {t('composer.autoPreview.fallback')}
        </p>
      ) : null}
      {hasDecisionReason ? (
        <div className="mb-2">
          <p className="mb-0.5 font-medium text-[var(--color-text)]">
            {t('composer.autoPreview.reasonTitle')}
          </p>
          <p className="break-words">{decisionReason}</p>
        </div>
      ) : null}
      {hasComparedDifferences ? (
        <div className="mb-2">
          <p className="mb-0.5 font-medium text-[var(--color-text)]">
            {t('composer.autoPreview.differencesTitle')}
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {rationale.comparedDifferences.map((difference) => (
              <li key={difference} className="break-words">
                {difference}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!hasDecisionReason && !hasComparedDifferences && isSingleCandidate ? (
        <p className="mb-2">{t('composer.autoPreview.singleCandidateSkip')}</p>
      ) : null}
      {showReasonCodes ? (
        <div>
          <p className="mb-0.5 font-medium text-[var(--color-text)]">
            {t('composer.autoPreview.reasonCodesTitle')}
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-[var(--color-text)]">
            {rationale.reasonCodes.join(' · ')}
          </p>
        </div>
      ) : null}
      {!hasDecisionReason &&
      !hasComparedDifferences &&
      isSingleCandidate &&
      rationale.reasonCodes.length > 0 ? (
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-[var(--color-text)]">
          {rationale.reasonCodes.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

export function WorkflowAutoChip({
  loading,
  decision,
  placeholder,
  previewPhase,
  previewRationale,
  hasPrompt,
  previewError,
  onConfirmWorkflow,
  onRequestFullPreview,
  fullPreviewLoading,
  children,
}: {
  loading: boolean
  decision: AutoWorkflowDecision | null
  placeholder: string
  previewPhase: WorkflowAutoPreviewPhase
  previewRationale: WorkflowAutoPreviewRationale | null
  hasPrompt: boolean
  previewError?: string | null
  onConfirmWorkflow?: (workflow: string) => void
  onRequestFullPreview?: () => void | Promise<void>
  fullPreviewLoading?: boolean
  children?: React.ReactNode
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const label = decision?.selectedWorkflow ?? placeholder
  const isPlaceholder = !decision
  const showConfidence = previewPhase === 'full' && decision != null
  const showStructureMatch =
    (previewPhase === 'deterministic' || previewPhase === null) && decision != null
  const showUnconfirmed = previewPhase !== 'full' && decision != null
  const showConfirmButton = Boolean(onRequestFullPreview) && previewPhase !== 'full' && hasPrompt

  return (
    <PopoverAnchor className="w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] pl-2.5 pr-2 text-left text-sm',
          isPlaceholder ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)]',
        )}
      >
        {loading ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-[var(--color-accent)]" />
        ) : (
          <Zap size={13} className="shrink-0 text-[var(--color-accent)]" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          auto
        </span>
        <ChevronDown size={12} className="shrink-0 text-[var(--color-muted)]" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} placement="bottom-start" className="w-80">
        <div className="p-1 text-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[var(--color-accent)]">
            <Sparkles size={14} />
            <span className="font-medium">{t('composer.autoPreview.title')}</span>
          </div>
          {decision ? (
            <>
              <p className="text-[var(--color-text)]">
                <span className="font-medium">{decision.selectedWorkflow}</span>
                {showConfidence ? (
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    {t('composer.autoPreview.confidence', { confidence: decision.confidence })}
                  </span>
                ) : null}
                {showStructureMatch ? (
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    {t('composer.autoPreview.structureMatch')}
                  </span>
                ) : null}
                {showUnconfirmed ? (
                  <span className="ml-2 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                    {t('composer.autoPreview.unconfirmed')}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {previewPhase === 'full'
                  ? t('composer.autoPreview.llmConfirmedHint')
                  : t('composer.autoPreview.deterministicHint')}
              </p>
              {decision.alternatives.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
                  {decision.alternatives.map((alt) => (
                    <li key={alt.name} className="flex items-center justify-between gap-2">
                      <span>{alt.name}</span>
                      {onConfirmWorkflow ? (
                        <button
                          type="button"
                          className="text-[var(--color-accent)] hover:underline"
                          onClick={() => {
                            onConfirmWorkflow(alt.name)
                            setOpen(false)
                          }}
                        >
                          {t('composer.autoPreview.useAlternative')}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {previewPhase === 'full' && previewRationale ? (
                <AutoPreviewRationaleBlock rationale={previewRationale} t={t} />
              ) : null}
            </>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">{placeholder}</p>
          )}
          {previewError ? (
            <p
              role="alert"
              className="mt-2 rounded border border-[color-mix(in_oklab,var(--color-status-failed)_45%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-status-failed)_12%,var(--color-panel))] px-2 py-1.5 text-xs text-[var(--color-status-failed)]"
            >
              <span className="font-medium">{t('composer.autoPreview.previewError')}</span>
              {previewError === 'Preview failed' ? null : (
                <span className="mt-0.5 block break-words text-[var(--color-text)]">
                  {previewError}
                </span>
              )}
            </p>
          ) : null}
          {showConfirmButton ? (
            <button
              type="button"
              disabled={loading || fullPreviewLoading}
              onClick={() => void onRequestFullPreview?.()}
              className="mt-2 w-full rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-50"
            >
              {fullPreviewLoading
                ? t('composer.autoPreview.confirmingLlm')
                : t('composer.autoPreview.confirmLlm')}
            </button>
          ) : null}
          {children}
        </div>
      </Popover>
    </PopoverAnchor>
  )
}
