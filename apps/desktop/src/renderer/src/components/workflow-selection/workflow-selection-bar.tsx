import {
  type AutoWorkflowDecision,
  type WorkflowRunOverride,
  type WorkflowSummary,
  workflowSummaryLabel,
} from '@planetz/shared'
import { ChevronDown, Waypoints } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useWorkflowAutoPreview } from '../../hooks/use-workflow-auto-preview.js'
import { useWorkflowLibraryPrefs } from '../../hooks/use-workflow-library-prefs.js'
import { useI18n } from '../../i18n/index.js'
import {
  baseWorkflowFromDisplayName,
  hasRunOverrideChangesForDisplayWorkflow,
} from '../../lib/workflow-run-override-draft.js'
import { AutoToggle } from '../composer-workflow-auto.js'
import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'
import { WorkflowAutoChip } from './workflow-auto-chip.js'
import { WorkflowPickerModal } from './workflow-picker-modal.js'

export function WorkflowSelectionBar({
  workflows,
  selectedWorkflow,
  onWorkflowChange,
  workflowMode,
  onWorkflowModeChange,
  promptTitle,
  promptBody,
  provider,
  model,
  disabled,
  onNewWorkflow,
  builtinWorkflowCategoryOrder,
  recentWorkflowNames,
  runOverride,
  onRunOverrideChange,
  confirmedWorkflow,
  onConfirmedWorkflowChange,
  onPreviewRoutingChange,
  onWorkflowCopied,
}: {
  workflows: WorkflowSummary[]
  selectedWorkflow: string
  onWorkflowChange: (name: string) => void
  workflowMode: 'manual' | 'auto'
  onWorkflowModeChange: (mode: 'manual' | 'auto') => void
  promptTitle?: string
  promptBody?: string
  provider?: string
  model?: string
  disabled?: boolean
  onNewWorkflow?: () => void
  builtinWorkflowCategoryOrder?: string[]
  recentWorkflowNames?: string[]
  runOverride?: WorkflowRunOverride
  onRunOverrideChange?: (override: WorkflowRunOverride | undefined) => void
  confirmedWorkflow?: string
  onConfirmedWorkflowChange?: (workflow: string | undefined) => void
  onPreviewRoutingChange?: (routing: {
    previewToken: string | null
    promptHash: string | null
    confirmedWorkflow?: string
    previewDecision?: AutoWorkflowDecision | null
  }) => void
  onWorkflowCopied?: (name: string) => void | Promise<void>
}) {
  const { t } = useI18n()
  const autoMode = workflowMode === 'auto'
  const [pickerOpen, setPickerOpen] = useState(false)

  const autoPreview = useWorkflowAutoPreview({
    enabled: autoMode,
    title: promptTitle,
    body: promptBody,
    provider,
    model,
  })
  const libraryPrefs = useWorkflowLibraryPrefs(autoMode)
  const [dismissedSuggestionHash, setDismissedSuggestionHash] = useState<string | null>(null)
  const [fullPreviewLoading, setFullPreviewLoading] = useState(false)
  const activeSuggestion =
    autoPreview.libraryAutoSuggestion &&
    autoPreview.promptHash &&
    autoPreview.promptHash !== dismissedSuggestionHash
      ? autoPreview.libraryAutoSuggestion
      : null

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset session dismiss when routing prompt identity changes
  useEffect(() => {
    setDismissedSuggestionHash(null)
  }, [autoPreview.promptHash])

  useEffect(() => {
    onPreviewRoutingChange?.({
      previewToken: autoPreview.previewToken,
      promptHash: autoPreview.promptHash,
      previewDecision: autoPreview.decision,
      ...(confirmedWorkflow ? { confirmedWorkflow } : {}),
    })
  }, [
    autoPreview.previewToken,
    autoPreview.promptHash,
    autoPreview.decision,
    confirmedWorkflow,
    onPreviewRoutingChange,
  ])

  const selectedBase = baseWorkflowFromDisplayName(selectedWorkflow)
  const selectedSummary = useMemo(
    () => workflows.find((w) => w.name === selectedBase),
    [workflows, selectedBase],
  )
  const hasRunOverride = hasRunOverrideChangesForDisplayWorkflow({
    displayWorkflow: selectedBase,
    runOverride,
  })

  const triggerLabel = selectedSummary
    ? workflowSummaryLabel(selectedSummary)
    : selectedWorkflow || t('composer.workflowPicker.triggerPlaceholder')

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        {autoMode ? (
          <div className="flex flex-col gap-1">
            <WorkflowAutoChip
              loading={autoPreview.loading}
              decision={autoPreview.decision}
              previewPhase={autoPreview.previewPhase}
              previewRationale={autoPreview.previewRationale}
              hasPrompt={autoPreview.hasPrompt}
              previewError={autoPreview.error}
              placeholder={t('composer.autoWorkflowPlaceholder')}
              fullPreviewLoading={fullPreviewLoading}
              onRequestFullPreview={async () => {
                setFullPreviewLoading(true)
                try {
                  await autoPreview.requestFullPreview()
                } finally {
                  setFullPreviewLoading(false)
                }
              }}
              onConfirmWorkflow={(workflow) => {
                onConfirmedWorkflowChange?.(workflow)
                onRunOverrideChange?.(undefined)
                onWorkflowModeChange('manual')
                onWorkflowChange(workflow)
              }}
            />
            {activeSuggestion ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-[11px] text-[var(--color-muted-strong)]">
                <span className="min-w-0 flex-1">
                  {t('composer.libraryAutoSuggest', {
                    workflow: activeSuggestion.displayName ?? activeSuggestion.workflowName,
                  })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() =>
                    void libraryPrefs
                      .enableWorkflowForAuto(activeSuggestion.workflowName)
                      .then(() => {
                        if (autoPreview.promptHash) {
                          setDismissedSuggestionHash(autoPreview.promptHash)
                        }
                      })
                  }
                >
                  {t('composer.libraryAutoSuggestAdd')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setDismissedSuggestionHash(autoPreview.promptHash)}
                >
                  {t('composer.libraryAutoSuggestDismiss')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            aria-label={t('composer.workflowPicker.triggerAria')}
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
            className={cn(
              'flex h-8 w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-2.5 pr-2 text-left text-sm text-[var(--color-text)]',
              'focus-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Waypoints size={13} className="shrink-0 text-[var(--color-accent)]" />
            <span className="min-w-0 flex-1 truncate">
              {triggerLabel}
              {hasRunOverride ? (
                <span className="ml-1 text-[var(--color-accent)]">
                  ◈ {t('composer.workflowPicker.modifiedSuffix')}
                </span>
              ) : null}
            </span>
            <ChevronDown size={14} className="shrink-0 text-[var(--color-muted)]" />
          </button>
        )}
      </div>
      <AutoToggle
        on={autoMode}
        disabled={disabled}
        ariaLabel={t('composer.autoToggleAria')}
        label={t('composer.autoToggle')}
        onChange={(next) => {
          onConfirmedWorkflowChange?.(undefined)
          onRunOverrideChange?.(undefined)
          onWorkflowModeChange(next ? 'auto' : 'manual')
        }}
      />
      <WorkflowPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workflows={workflows}
        value={selectedWorkflow}
        runOverride={runOverride}
        allowOverrides={Boolean(onRunOverrideChange)}
        onApply={(workflow, override) => {
          onWorkflowChange(workflow)
          onRunOverrideChange?.(override)
        }}
        onNewWorkflow={onNewWorkflow}
        builtinWorkflowCategoryOrder={builtinWorkflowCategoryOrder}
        recentWorkflowNames={recentWorkflowNames}
        onWorkflowCopied={onWorkflowCopied}
      />
    </div>
  )
}
