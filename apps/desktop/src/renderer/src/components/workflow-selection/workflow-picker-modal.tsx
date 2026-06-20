import {
  CORE_GROUP_KEY,
  canEnablePackInWorkspace,
  canEnableWorkflowInWorkspace,
  ENABLED_LIBRARY_GROUP_KEY,
  type ExecutionOverrideOptionSources,
  filterWorkflowSummaries,
  isBrowseLibraryAction,
  isLibraryBuiltinWorkflow,
  listLibraryPackBrowseGroups,
  partitionPackBrowseItems,
  shouldShowImplicitEnableBadge,
  tierMetaByWorkflowName,
  type WorkflowPreviewResult,
  type WorkflowPreviewStep,
  type WorkflowRunOverride,
  type WorkflowSummary,
  workflowDisplayLabel,
  workflowPickerSurfacePrefsFromUi,
} from '@planetz/shared'
import {
  ArrowDown,
  BookOpen,
  Check,
  CornerDownRight,
  FileEdit,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  SquarePen,
  User,
  Waypoints,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useExecutionOptionSources } from '../../hooks/use-execution-option-sources.js'
import { usePushToast } from '../../hooks/use-toast.js'
import { useWorkflowPickerPrefs } from '../../hooks/use-workflow-picker-prefs.js'
import { useWorkflowPreview } from '../../hooks/use-workflow-preview.js'
import { useI18n } from '../../i18n/index.js'
import { copyWorkflowToProject } from '../../lib/copy-workflow-to-project.js'
import {
  baseWorkflowFromDisplayName,
  changeWorkflowStepExecutionProfile,
  normalizeRunOverrideForDisplayWorkflow,
} from '../../lib/workflow-run-override-draft.js'
import { ExecutionProfileFields } from '../execution-profile-fields.js'
import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'
import { Dialog } from '../ui/dialog.js'
import { Input } from '../ui/input.js'
import { buildWorkflowComboboxGroups } from '../workflow-combobox-groups.js'
import { ImplicitEnableBadge } from './implicit-enable-badge.js'
import { LibraryWorkflowRowActions } from './library-workflow-row-actions.js'
import { WorkflowFeatureBadges } from './workflow-feature-badges.js'
import { WorkflowInlinePreviewSnippet } from './workflow-inline-preview-snippet.js'

function shouldShowLibraryRowActions(
  workflow: WorkflowSummary,
  groupKey: string,
  query: string,
): boolean {
  if (!isLibraryBuiltinWorkflow(workflow.name)) return false
  if (workflow.source !== 'builtin') return false
  if (groupKey === ENABLED_LIBRARY_GROUP_KEY) return true
  return query.trim().length > 0
}

function StepEditMarker({ edit }: { edit?: boolean }) {
  return edit ? (
    <span
      title="edit step"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--color-status-failed)]/15 text-[var(--color-status-failed)]"
    >
      <SquarePen size={10} />
    </span>
  ) : (
    <span
      title="read-only step"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--color-surface)] text-[var(--color-muted)]"
    >
      <Search size={10} />
    </span>
  )
}

function RuleTargetChip({ target }: { target: string }) {
  const terminal = target === 'COMPLETE' || target === 'ABORT'
  return (
    <span
      className={cn(
        'rounded px-1 py-px font-mono text-[10px]',
        target === 'COMPLETE' && 'bg-[var(--color-status-ok)]/15 text-[var(--color-status-ok)]',
        target === 'ABORT' &&
          'bg-[var(--color-status-failed)]/15 text-[var(--color-status-failed)]',
        !terminal && 'bg-[var(--color-surface)] text-[var(--color-text)]',
      )}
    >
      {target}
    </span>
  )
}

function StepRules({ step }: { step: WorkflowPreviewStep }) {
  const rules = step.rules ?? []
  if (rules.length === 0) return null
  return (
    <ul className="mt-1 flex flex-col gap-0.5 pl-7">
      {rules.map((rule, i) => {
        const target = rule.next || rule.return
        if (!target) return null
        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: rules have no stable id
            key={i}
            className="flex min-w-0 items-center gap-1 text-[10px] text-[var(--color-muted)]"
          >
            <CornerDownRight size={10} className="shrink-0" />
            {rule.condition ? (
              <span className="min-w-0 truncate" title={rule.condition}>
                {rule.condition}
              </span>
            ) : null}
            <span className="shrink-0">→</span>
            <RuleTargetChip target={target} />
            {rule.return ? (
              <span className="shrink-0 text-[var(--color-muted)]/70">(return)</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function StepGraph({
  preview,
  selectedStep,
  onSelectStep,
  overrideByStep,
}: {
  preview: WorkflowPreviewResult
  selectedStep: string | null
  onSelectStep: (name: string) => void
  overrideByStep: Map<string, { model?: string; provider?: string }>
}) {
  return (
    <ol className="flex flex-col">
      {preview.steps.map((step, i) => {
        const patch = overrideByStep.get(step.name)
        const hasOverride = Boolean(patch?.provider || patch?.model)
        const selected = selectedStep === step.name
        const isInitial = preview.initialStep ? preview.initialStep === step.name : i === 0
        const hasRules = (step.rules ?? []).some((r) => r.next || r.return)
        return (
          <li key={step.name} className="flex flex-col">
            <div
              className={cn(
                'flex flex-col rounded-md border px-2 py-1.5 transition-colors',
                selected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]/60 hover:border-[var(--color-border-strong)]',
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectStep(step.name)}
                  className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded text-left"
                >
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      selected
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
                        : 'border border-[var(--color-border-strong)] text-[var(--color-muted)]',
                    )}
                  >
                    {i + 1}
                  </span>
                  <StepEditMarker edit={step.edit} />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--color-text)]"
                    title={step.name}
                  >
                    {step.name}
                  </span>
                  {isInitial ? (
                    <span className="shrink-0 rounded bg-[var(--color-surface)] px-1 text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
                      start
                    </span>
                  ) : null}
                  {step.persona ? (
                    <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted)]">
                      {step.persona}
                    </span>
                  ) : null}
                  {hasOverride ? (
                    <span className="shrink-0 rounded bg-[var(--color-accent-soft)] px-1 text-[9px] uppercase tracking-wide text-[var(--color-accent)]">
                      override
                    </span>
                  ) : null}
                </button>
              </div>
              <StepRules step={step} />
            </div>
            {i < preview.steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'flex justify-center py-0.5 text-[var(--color-muted)]',
                  hasRules && 'opacity-40',
                )}
              >
                <ArrowDown size={11} />
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function FacetRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string
}) {
  if (!value) return null
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-[var(--color-muted)]">{icon}</span>
      <span className="w-20 shrink-0 text-[var(--color-muted)]">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[var(--color-text)]" title={value}>
        {value}
      </span>
    </div>
  )
}

function StepDetailPane({
  preview,
  stepName,
  allowOverrides,
  overrideByStep,
  onStepExecutionProfileChange,
  profileSources,
  profileSourcesLoading,
  profileSourcesError,
}: {
  preview: WorkflowPreviewResult
  stepName: string | null
  allowOverrides: boolean
  overrideByStep: Map<string, { model?: string; provider?: string }>
  onStepExecutionProfileChange: (input: {
    stepName: string
    provider: string
    model: string
    stepDefaultProvider?: string
    stepDefaultModel?: string
  }) => void
  profileSources: Pick<
    ExecutionOverrideOptionSources,
    'engineConfig' | 'catalog' | 'workflowDefaults'
  >
  profileSourcesLoading: boolean
  profileSourcesError: string | null
}) {
  const { t } = useI18n()
  const step = preview.steps.find((s) => s.name === stepName) ?? null
  const stepOverride = step ? overrideByStep.get(step.name) : undefined
  const canEditExecutionProfile = allowOverrides && preview.overridesAllowed && Boolean(step)
  const facets = preview.facets

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {t('composer.workflowPicker.stepDetail')}
        </p>
        {step ? (
          <div className="flex flex-col gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-2">
            <div className="flex items-center gap-2">
              <StepEditMarker edit={step.edit} />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold text-[var(--color-text-strong)]">
                {step.name}
              </span>
            </div>
            <FacetRow icon={<User size={11} />} label="persona" value={step.persona} />
            <FacetRow icon={<ShieldCheck size={11} />} label="policy" value={step.policy} />
            <FacetRow icon={<BookOpen size={11} />} label="knowledge" value={step.knowledge} />
            <FacetRow icon={<Waypoints size={11} />} label="model" value={step.model} />
            <FacetRow icon={<Waypoints size={11} />} label="provider" value={step.provider} />
            <FacetRow icon={<Lock size={11} />} label="permission" value={step.permission} />
            {step.instruction ? (
              <div className="flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  instruction
                </p>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-[var(--color-panel)] p-2 font-mono text-[10px] leading-relaxed text-[var(--color-muted-strong)]">
                  {step.instruction}
                </pre>
              </div>
            ) : null}
            {canEditExecutionProfile && step ? (
              <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/40 p-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  {t('composer.workflowPicker.executionProfile')}
                </p>
                <ExecutionProfileFields
                  providerId={`workflow-picker-provider-${step.name}`}
                  modelId={`workflow-picker-model-${step.name}`}
                  providerLabel={t('composer.workflowPicker.overrideProvider')}
                  modelLabel={t('composer.workflowPicker.overrideModel')}
                  providerEmptyLabel={t('composer.workflowPicker.inherit')}
                  modelEmptyLabel={t('composer.workflowPicker.inherit')}
                  showEffort={false}
                  value={{
                    provider: stepOverride?.provider ?? '',
                    model: stepOverride?.model ?? '',
                  }}
                  sources={{
                    ...profileSources,
                    currentProvider: stepOverride?.provider ?? step.provider,
                    currentModel: stepOverride?.model ?? step.model,
                  }}
                  workflowName={preview.name}
                  disabled={profileSourcesLoading}
                  onChange={({ provider, model }) =>
                    onStepExecutionProfileChange({
                      stepName: step.name,
                      provider,
                      model,
                      stepDefaultProvider: step.provider,
                      stepDefaultModel: step.model,
                    })
                  }
                />
                {profileSourcesError ? (
                  <p className="text-[10px] text-[var(--color-status-warn,#d97706)]">
                    {profileSourcesError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-[var(--color-border)] p-2 text-[11px] text-[var(--color-muted)]">
            {t('composer.workflowPicker.noStepSelected')}
          </p>
        )}
      </div>

      {facets ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {t('composer.workflowPicker.workflowFacets')}
          </p>
          <div className="flex flex-col gap-1">
            {(
              [
                ['personas', <User key="i" size={11} />, facets.personas],
                ['policies', <ShieldCheck key="i" size={11} />, facets.policies],
                ['knowledge', <BookOpen key="i" size={11} />, facets.knowledge],
                ['instructions', <FileEdit key="i" size={11} />, facets.instructions],
                ['report_formats', <FileEdit key="i" size={11} />, facets.reportFormats],
              ] as const
            ).map(([label, icon, keys]) =>
              keys.length > 0 ? (
                <div key={label} className="flex items-start gap-1.5 text-[11px]">
                  <span className="mt-0.5 text-[var(--color-muted)]">{icon}</span>
                  <span className="w-24 shrink-0 text-[var(--color-muted)]">{label}</span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {keys.map((key) => (
                      <span
                        key={key}
                        className="rounded bg-[var(--color-surface)] px-1.5 py-px font-mono text-[10px] text-[var(--color-text)]"
                      >
                        {key}
                      </span>
                    ))}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function WorkflowPickerModal({
  open,
  onClose,
  workflows,
  value,
  runOverride,
  onApply,
  onNewWorkflow,
  builtinWorkflowCategoryOrder = [],
  recentWorkflowNames = [],
  allowOverrides = true,
  onWorkflowCopied,
}: {
  open: boolean
  onClose: () => void
  workflows: WorkflowSummary[]
  value: string
  runOverride?: WorkflowRunOverride
  onApply: (workflow: string, override: WorkflowRunOverride | undefined) => void
  onNewWorkflow?: () => void
  builtinWorkflowCategoryOrder?: string[]
  recentWorkflowNames?: string[]
  allowOverrides?: boolean
  onWorkflowCopied?: (name: string) => void | Promise<void>
}) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const pickerPrefs = useWorkflowPickerPrefs(open)
  const [query, setQuery] = useState('')
  const [libraryBrowseMode, setLibraryBrowseMode] = useState(false)
  const [highlighted, setHighlighted] = useState<string>(() => baseWorkflowFromDisplayName(value))
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [draftOverride, setDraftOverride] = useState<WorkflowRunOverride | undefined>(undefined)
  const [copiedProjectNames, setCopiedProjectNames] = useState<ReadonlySet<string>>(() => new Set())
  const executionOptions = useExecutionOptionSources({
    workflowName: highlighted,
    enabled: open && Boolean(highlighted) && allowOverrides,
  })

  useEffect(() => {
    if (!open) return
    const base = baseWorkflowFromDisplayName(value)
    setQuery('')
    setLibraryBrowseMode(false)
    setHighlighted(base)
    setSelectedStep(null)
    setCopiedProjectNames(new Set())
    setDraftOverride(normalizeRunOverrideForDisplayWorkflow({ displayWorkflow: base, runOverride }))
  }, [open, value, runOverride])

  const onWorkflowPreviewLoaded = useCallback((result: WorkflowPreviewResult) => {
    setSelectedStep((prev) => (prev && result.steps.some((s) => s.name === prev) ? prev : null))
  }, [])
  const previewWorkflowName =
    open && highlighted && !isBrowseLibraryAction(highlighted) ? highlighted : null
  const { preview, loading, loadError } = useWorkflowPreview(
    previewWorkflowName,
    open,
    onWorkflowPreviewLoaded,
  )

  const tierMeta = useMemo(() => tierMetaByWorkflowName(workflows), [workflows])
  const filtered = useMemo(
    () => filterWorkflowSummaries(query, workflows, tierMeta),
    [query, workflows, tierMeta],
  )
  const defaultSurfacePrefs = useMemo(() => workflowPickerSurfacePrefsFromUi({}), [])
  const surfacePrefs = pickerPrefs.prefs ?? defaultSurfacePrefs
  const groupTitles = useMemo(
    () => ({
      core: t('composer.workflowPicker.groupCore'),
      enabledLibrary: t('composer.workflowPicker.groupLibrary'),
      browseLibrary: t('composer.workflowPicker.groupBrowseLibrary'),
    }),
    [t],
  )
  const groups = useMemo(
    () =>
      buildWorkflowComboboxGroups(
        filtered,
        builtinWorkflowCategoryOrder,
        recentWorkflowNames,
        surfacePrefs,
        query,
        groupTitles,
      ),
    [filtered, builtinWorkflowCategoryOrder, recentWorkflowNames, surfacePrefs, query, groupTitles],
  )
  const libraryPackGroups = useMemo(
    () => listLibraryPackBrowseGroups({ workflows: filtered, prefs: surfacePrefs }),
    [filtered, surfacePrefs],
  )

  const overrideByStep = useMemo(
    () =>
      new Map(
        draftOverride?.baseWorkflow === highlighted
          ? draftOverride.stepOverrides.map((o) => [o.stepName, o])
          : [],
      ),
    [draftOverride, highlighted],
  )
  const hasDraftOverride = overrideByStep.size > 0
  const highlightedIsLibrary = useMemo(() => {
    if (!highlighted || isBrowseLibraryAction(highlighted)) return false
    const summary = workflows.find((workflow) => workflow.name === highlighted)
    if (!summary) return false
    return isLibraryBuiltinWorkflow(summary.name)
  }, [highlighted, workflows])

  const applyWorkflow = useCallback(
    (workflowName: string, override: WorkflowRunOverride | undefined = undefined) => {
      onApply(workflowName, override)
      onClose()
    },
    [onApply, onClose],
  )

  const handleCopyToProject = useCallback(
    async (name: string) => {
      const result = await copyWorkflowToProject({
        name,
        workflows,
        alsoProjectNames: copiedProjectNames,
        confirmOverwrite: async (workflowName) =>
          window.confirm(
            t('composer.workflowPicker.copyToProjectOverwrite', { name: workflowName }),
          ),
      })
      if (result === 'copied') {
        setCopiedProjectNames((current) => new Set([...current, name]))
        await onWorkflowCopied?.(name)
        pushToast({
          kind: 'success',
          title: t('composer.workflowPicker.copyToProjectSuccess'),
          message: name,
        })
      } else if (result === 'failed') {
        pushToast({
          kind: 'error',
          title: t('composer.workflowPicker.copyToProjectError'),
          message: name,
        })
      }
    },
    [copiedProjectNames, onWorkflowCopied, pushToast, t, workflows],
  )

  function highlight(name: string) {
    if (isBrowseLibraryAction(name)) {
      setLibraryBrowseMode(true)
      return
    }
    if (name === highlighted) return
    setHighlighted(name)
    setSelectedStep(null)
    setDraftOverride(normalizeRunOverrideForDisplayWorkflow({ displayWorkflow: name, runOverride }))
  }

  function handleStepExecutionProfileChange(input: {
    stepName: string
    provider: string
    model: string
    stepDefaultProvider?: string
    stepDefaultModel?: string
  }) {
    setDraftOverride((prev) =>
      changeWorkflowStepExecutionProfile({
        displayWorkflow: highlighted,
        runOverride: prev,
        stepName: input.stepName,
        providerValue: input.provider,
        modelValue: input.model,
        stepDefaultProvider: input.stepDefaultProvider,
        stepDefaultModel: input.stepDefaultModel,
      }),
    )
  }

  const renderedNames = new Set<string>()

  const renderLibraryWorkflowRow = (wf: WorkflowSummary, keyPrefix: string) => {
    const isHighlighted = wf.name === highlighted
    const libraryPrefs = surfacePrefs.workflowLibrary
    const showImplicitBadge = shouldShowImplicitEnableBadge(wf.name, libraryPrefs)
    return (
      <li key={keyPrefix}>
        <div
          className={cn('flex flex-col gap-0.5', isHighlighted && 'bg-[var(--color-accent-soft)]')}
        >
          <LibraryWorkflowRowActions
            displayLabel={workflowDisplayLabel(wf, tierMeta.get(wf.name))}
            description={wf.description}
            isHighlighted={isHighlighted}
            onHighlight={() => highlight(wf.name)}
            onUseOnce={() => applyWorkflow(wf.name)}
            onEnableInWorkspace={() => void pickerPrefs.enableWorkflowInWorkspace(wf.name)}
            onCopyToProject={() => void handleCopyToProject(wf.name)}
            showEnableInWorkspace={canEnableWorkflowInWorkspace(wf.name).allowed}
          />
          {showImplicitBadge ? (
            <ImplicitEnableBadge
              workflowName={wf.name}
              onDismiss={() => void pickerPrefs.dismissImplicitWorkflow(wf.name)}
              className="flex-nowrap px-3 pb-1.5"
            />
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      title={t('composer.workflowPicker.title')}
      description={t('composer.workflowPicker.description')}
      bodyClassName="flex min-h-0 overflow-hidden p-0"
      footer={
        <>
          {onNewWorkflow ? (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto"
              leading={<Plus size={13} />}
              onClick={() => {
                onClose()
                onNewWorkflow()
              }}
            >
              {t('composer.workflowPicker.newWorkflow')}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('composer.workflowPicker.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!highlighted || isBrowseLibraryAction(highlighted)}
            onClick={() => {
              applyWorkflow(highlighted, hasDraftOverride ? draftOverride : undefined)
            }}
          >
            {highlightedIsLibrary
              ? t('composer.workflowPicker.useOnce')
              : hasDraftOverride
                ? t('composer.workflowPicker.selectModified')
                : t('composer.workflowPicker.select')}
          </Button>
        </>
      }
    >
      {/* Left: workflow list */}
      <div className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] p-2">
          <span className="relative inline-flex w-full items-center">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 text-[var(--color-muted)]"
            />
            <Input
              type="search"
              className="h-8 pl-7"
              placeholder={t('composer.workflowPicker.filterPlaceholder')}
              value={query}
              aria-label={t('composer.workflowPicker.filterPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {libraryBrowseMode ? (
            <>
              <div className="border-b border-[var(--color-border)] px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setLibraryBrowseMode(false)}
                >
                  {t('composer.workflowPicker.backToPicker')}
                </Button>
                <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  {t('composer.workflowPicker.libraryBrowseTitle')}
                </p>
              </div>
              {libraryPackGroups.map((pack) => {
                const memberNames = pack.items.map((workflow) => workflow.name)
                const packEnableGuard = canEnablePackInWorkspace(memberNames)
                const packEnabled = surfacePrefs.workflowLibrary.enabledPacks.includes(pack.packId)
                const { active, deprecated } = partitionPackBrowseItems(pack.items)
                return (
                  <div key={pack.packId} className="flex flex-col">
                    <div className="flex items-center gap-2 px-3 pb-0.5 pt-2">
                      <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        {pack.title}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 shrink-0 px-2 text-[10px]"
                        disabled={!packEnabled && !packEnableGuard.allowed}
                        onClick={() =>
                          void pickerPrefs.enablePackInWorkspace(pack.packId, memberNames)
                        }
                      >
                        {t('composer.workflowPicker.enablePackInWorkspace')}
                      </Button>
                    </div>
                    <ul>
                      {active.map((wf) =>
                        renderLibraryWorkflowRow(wf, `browse:${pack.packId}:${wf.name}`),
                      )}
                    </ul>
                    {deprecated.length > 0 ? (
                      <details className="mx-2 mb-2 rounded-md border border-dashed border-[var(--color-border)] px-2 py-1">
                        <summary className="cursor-pointer py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          {t('composer.workflowPicker.deprecatedPackSection', {
                            count: deprecated.length,
                          })}
                        </summary>
                        <ul>
                          {deprecated.map((wf) =>
                            renderLibraryWorkflowRow(
                              wf,
                              `browse:${pack.packId}:deprecated:${wf.name}`,
                            ),
                          )}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                )
              })}
            </>
          ) : groups.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-muted)]">
              {t('composer.workflowPicker.noMatches')}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="flex flex-col">
                <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  {group.title}
                </p>
                <ul>
                  {group.items.map((wf) => {
                    if (renderedNames.has(wf.name)) return null
                    renderedNames.add(wf.name)
                    if (isBrowseLibraryAction(wf.name)) {
                      return (
                        <li key={`${group.key}:${wf.name}`}>
                          <button
                            type="button"
                            onClick={() => highlight(wf.name)}
                            className="flex w-full px-3 py-1.5 text-left text-sm text-[var(--color-accent)] hover:bg-[var(--color-panel-strong)]"
                          >
                            {group.title}
                          </button>
                        </li>
                      )
                    }
                    const isHighlighted = wf.name === highlighted
                    const isCurrent = wf.name === baseWorkflowFromDisplayName(value)
                    const libraryPrefs = surfacePrefs.workflowLibrary
                    const showImplicitBadge = shouldShowImplicitEnableBadge(wf.name, libraryPrefs)
                    const showLibraryActions = shouldShowLibraryRowActions(wf, group.key, query)
                    if (showLibraryActions) {
                      return renderLibraryWorkflowRow(wf, `${group.key}:${wf.name}`)
                    }
                    const showCoreInlinePreview = group.key === CORE_GROUP_KEY && isHighlighted
                    return (
                      <li key={`${group.key}:${wf.name}`}>
                        <div
                          className={cn(
                            'flex flex-col gap-0.5 transition-colors',
                            isHighlighted
                              ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-strong)]'
                              : 'hover:bg-[var(--color-panel-strong)]',
                          )}
                        >
                          <button
                            type="button"
                            aria-pressed={isHighlighted}
                            onClick={() => highlight(wf.name)}
                            className="flex w-full flex-col gap-0.5 px-3 py-1.5 text-left text-sm"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {workflowDisplayLabel(wf, tierMeta.get(wf.name))}
                              </span>
                              {isCurrent ? (
                                <Check size={12} className="shrink-0 text-[var(--color-accent)]" />
                              ) : null}
                            </span>
                            {wf.description ? (
                              <span className="truncate text-[11px] text-[var(--color-muted)]">
                                {wf.description}
                              </span>
                            ) : null}
                          </button>
                          {showCoreInlinePreview ? (
                            <WorkflowInlinePreviewSnippet
                              preview={preview}
                              loading={loading}
                              loadError={loadError}
                            />
                          ) : null}
                          {showImplicitBadge ? (
                            <ImplicitEnableBadge
                              workflowName={wf.name}
                              onDismiss={() => void pickerPrefs.dismissImplicitWorkflow(wf.name)}
                              className="flex-nowrap px-3 pb-1.5"
                            />
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center: workflow detail + step graph */}
      <div className="flex min-w-0 flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-[var(--color-muted)]">
            <Loader2 size={14} className="animate-spin" />
            {t('composer.workflowPicker.loading')}
          </div>
        ) : preview ? (
          <>
            <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Waypoints size={14} className="shrink-0 text-[var(--color-accent)]" />
                <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-strong)]">
                  {preview.name}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                  ({preview.source})
                </span>
              </div>
              {preview.description ? (
                <p className="text-xs leading-relaxed text-[var(--color-muted-strong)]">
                  {preview.description}
                </p>
              ) : null}
              <WorkflowFeatureBadges preview={preview} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {t('composer.workflowPicker.steps', { count: String(preview.steps.length) })}
              </p>
              <StepGraph
                preview={preview}
                selectedStep={selectedStep}
                onSelectStep={(name) => setSelectedStep((prev) => (prev === name ? null : name))}
                overrideByStep={overrideByStep}
              />
              {preview.strictTier ? (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                  <Lock size={10} />
                  {t('composer.workflowPicker.strictNote')}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-[var(--color-muted)]">
            {loadError
              ? t('composer.workflowPicker.loadError')
              : t('composer.workflowPicker.noMatches')}
          </div>
        )}
      </div>

      {/* Right: step / workflow facet detail */}
      <div className="flex w-72 shrink-0 flex-col border-l border-[var(--color-border)]">
        {preview ? (
          <StepDetailPane
            preview={preview}
            stepName={selectedStep}
            allowOverrides={allowOverrides}
            overrideByStep={overrideByStep}
            onStepExecutionProfileChange={handleStepExecutionProfileChange}
            profileSources={{
              engineConfig: executionOptions.engineConfig,
              catalog: executionOptions.catalog,
              workflowDefaults: executionOptions.workflowDefaults,
            }}
            profileSourcesLoading={executionOptions.loading}
            profileSourcesError={executionOptions.loadError}
          />
        ) : (
          <div className="p-3 text-[11px] text-[var(--color-muted)]">
            {t('composer.workflowPicker.noStepSelected')}
          </div>
        )}
      </div>
    </Dialog>
  )
}
