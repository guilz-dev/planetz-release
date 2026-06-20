import {
  collectProviderOptions,
  type ExecutionOverrideOptionSources,
  effortHelpText,
  isOrbitProviderId,
  type OrbitProviderId,
  orbitProviderDisplayLabel,
  type ProviderEffortCandidate,
  type ProviderModelCandidate,
  providerSupportsEffort,
} from '@planetz/shared'
import { RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { invalidateProviderModelsCache } from '../hooks/provider-model-candidates-cache.js'
import { useProviderEffortCandidates } from '../hooks/use-provider-effort-candidates'
import type { ProviderModelCandidatesState } from '../hooks/use-provider-model-candidates'
import { useProviderModelCandidates } from '../hooks/use-provider-model-candidates'
import { useI18n } from '../i18n'
import {
  buildModelFilterOptions,
  ModelFilterCombobox,
  providerModelCandidateLabel,
} from './model-filter-combobox'
import { Button } from './ui/button'
import { Field, Input } from './ui/input'
import { Select } from './ui/select'

export interface ExecutionProfileValue {
  provider: string
  model: string
  effort?: string
}

export interface ExecutionProfileFieldsProps {
  value: ExecutionProfileValue
  onChange: (next: ExecutionProfileValue) => void
  sources: ExecutionOverrideOptionSources
  disabled?: boolean
  providerId?: string
  modelId?: string
  effortId?: string
  providerLabel?: string
  modelLabel?: string
  effortLabel?: string
  providerEmptyLabel?: string
  modelEmptyLabel?: string
  effortEmptyLabel?: string
  /** When set, workflow YAML defaults are included in model candidate merge. */
  workflowName?: string
  /** Bust candidate cache when upstream config changes. */
  reloadKey?: number | string
  /** When true, show configured model count hint under model select. */
  showCatalogHint?: boolean
  /** When false, omit the empty provider option (use when defaults are pre-selected). */
  showProviderEmptyOption?: boolean
  /** When false, hide effort override inputs even for effort-capable providers. */
  showEffort?: boolean
  /**
   * When set, restrict provider <option>s to this set (intersection with collected options).
   * The saved current value is always preserved as a fallback "(saved)" option so the user
   * can see it even if it falls outside the allowed set.
   */
  allowedProviders?: ReadonlyArray<string>
}

function providerOptionLabel(id: string): string {
  if (isOrbitProviderId(id)) {
    return `${orbitProviderDisplayLabel(id as OrbitProviderId)} (${id})`
  }
  return id
}

function sourceBadgeClass(
  source: ProviderModelCandidate['source'] | ProviderEffortCandidate['source'],
): string {
  switch (source) {
    case 'live':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'history':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'workspace':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
    case 'suggested':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
    default:
      return 'bg-[var(--color-surface-elevated)] text-[var(--color-muted)]'
  }
}

interface ExecutionProfileModelFieldProps {
  value: ExecutionProfileValue
  onChange: (next: ExecutionProfileValue) => void
  onCommitModelSelection: (provider: string, model: string) => void
  modelId: string
  modelLabel: string
  modelEmptyLabel: string
  disabled: boolean
  providerSelected: boolean
  modelCandidates: ProviderModelCandidatesState
  showCatalogHint: boolean
  catalogModelCount: number
}

function ExecutionProfileModelField({
  value,
  onChange,
  onCommitModelSelection,
  modelId,
  modelLabel,
  modelEmptyLabel,
  disabled,
  providerSelected,
  modelCandidates,
  showCatalogHint,
  catalogModelCount,
}: ExecutionProfileModelFieldProps) {
  const { t } = useI18n()
  const modelListId = `${modelId}-datalist`
  const useSelect = modelCandidates.modelFieldMode === 'select'
  const fieldDisabled = disabled || !providerSelected || (useSelect && modelCandidates.loading)
  const modelFilterOptions = buildModelFilterOptions({
    candidates: modelCandidates.candidates,
    emptyOptionLabel: modelEmptyLabel,
    savedValue: value.model,
  })

  return (
    <Field label={modelLabel} htmlFor={modelId}>
      {useSelect ? (
        <ModelFilterCombobox
          id={modelId}
          className="w-full"
          options={modelFilterOptions}
          value={value.model}
          disabled={fieldDisabled}
          placeholder={modelEmptyLabel}
          onChange={(nextModel) => {
            onChange({ ...value, model: nextModel })
            onCommitModelSelection(value.provider, nextModel)
          }}
        />
      ) : (
        <>
          <Input
            id={modelId}
            list={modelListId}
            disabled={disabled || !providerSelected}
            value={value.model}
            placeholder={modelEmptyLabel}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
            onBlur={() => onCommitModelSelection(value.provider, value.model)}
          />
          <datalist id={modelListId}>
            {modelCandidates.candidates.map((candidate) => (
              <option key={`${candidate.source}:${candidate.id}`} value={candidate.id}>
                {providerModelCandidateLabel(candidate)}
              </option>
            ))}
          </datalist>
        </>
      )}
      {value.provider.trim() === 'cursor' ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="subtle"
            size="sm"
            disabled={disabled || modelCandidates.loading}
            leading={
              <RefreshCw size={12} className={modelCandidates.loading ? 'animate-spin' : ''} />
            }
            onClick={() => modelCandidates.refresh()}
          >
            {t('executionProfile.refreshLiveModels')}
          </Button>
          {modelCandidates.fetchedAt ? (
            <span className="text-[10px] text-[var(--color-muted)]">
              {modelCandidates.stale
                ? t('executionProfile.liveListStale')
                : t('executionProfile.liveListCached')}
            </span>
          ) : null}
        </div>
      ) : null}
      {modelCandidates.liveError ? (
        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
          {t('executionProfile.liveModelsUnavailable', { error: modelCandidates.liveError })}
        </p>
      ) : null}
      {!modelCandidates.modelSelectOnly && modelCandidates.candidates.length > 0 ? (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-1.5">
          {modelCandidates.candidates.map((candidate) => (
            <li
              key={`${candidate.source}:${candidate.id}`}
              className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-[var(--color-surface-elevated)]"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-xs text-[var(--color-text)]"
                disabled={disabled}
                onClick={() => {
                  onChange({ ...value, model: candidate.id })
                  onCommitModelSelection(value.provider, candidate.id)
                }}
              >
                {providerModelCandidateLabel(candidate)}
              </button>
              <span
                className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ${sourceBadgeClass(candidate.source)}`}
              >
                {candidate.source}
              </span>
              {candidate.source === 'history' ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  aria-label={`Remove ${candidate.id} from history`}
                  disabled={disabled}
                  onClick={() => void modelCandidates.deleteHistoryItem(candidate.id)}
                >
                  <X size={12} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {showCatalogHint && value.provider.trim() ? (
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">
          {modelCandidates.modelSelectOnly
            ? t('executionProfile.catalogHintSelectFromList')
            : catalogModelCount > 0
              ? t('executionProfile.catalogHintWithModels', { count: catalogModelCount })
              : t('executionProfile.catalogHintManualEntry')}
        </p>
      ) : null}
    </Field>
  )
}

export function ExecutionProfileFields({
  value,
  onChange,
  sources,
  disabled = false,
  providerId = 'execution-profile-provider',
  modelId = 'execution-profile-model',
  effortId = 'execution-profile-effort',
  providerLabel = 'Provider',
  modelLabel = 'Model',
  effortLabel = 'Effort',
  providerEmptyLabel = '(not set)',
  modelEmptyLabel = '(not set)',
  effortEmptyLabel = '(not set)',
  workflowName,
  reloadKey,
  showCatalogHint = false,
  showProviderEmptyOption = true,
  showEffort = true,
  allowedProviders,
}: ExecutionProfileFieldsProps) {
  const pendingProviderRestoreRef = useRef<string | null>(null)
  const providerOptions = useMemo(() => {
    const collected = collectProviderOptions({
      ...sources,
      currentProvider: value.provider || sources.currentProvider,
    })
    if (!allowedProviders) return collected
    const allowedSet = new Set(allowedProviders)
    return collected.filter((id) => allowedSet.has(id))
  }, [sources, value.provider, allowedProviders])

  const canShowEffort = showEffort && providerSupportsEffort(value.provider)

  const modelCandidates = useProviderModelCandidates({
    provider: value.provider,
    currentModel: value.model,
    workflowName,
    reloadKey,
    enabled: !disabled && Boolean(value.provider.trim()),
  })

  const effortCandidates = useProviderEffortCandidates({
    provider: value.provider,
    currentEffort: value.effort ?? '',
    workflowName,
    reloadKey,
    enabled: !disabled && canShowEffort,
  })

  const catalogModelCount =
    value.provider.trim() && sources.catalog?.modelsByProvider[value.provider.trim()]
      ? (sources.catalog.modelsByProvider[value.provider.trim()]?.length ?? 0)
      : 0

  const effortListId = `${effortId}-datalist`
  const effortHelp = effortHelpText(value.provider)

  const rememberModelSelection = useCallback(async (provider: string, model: string) => {
    const providerId = provider.trim()
    if (!providerId) return
    try {
      await window.orbit.rememberProviderModelSelection({
        provider: providerId,
        ...(model.trim() ? { model: model.trim() } : {}),
      })
    } catch (error: unknown) {
      console.warn('[ExecutionProfileFields] failed to remember provider model selection:', error)
    }
  }, [])

  useEffect(() => {
    const pendingProvider = pendingProviderRestoreRef.current
    const providerId = value.provider.trim()
    if (!pendingProvider || pendingProvider !== providerId) return
    if (modelCandidates.loading) return
    pendingProviderRestoreRef.current = null
    if (value.model.trim()) return
    const rememberedModel = modelCandidates.lastSelectedModel?.trim() ?? ''
    if (rememberedModel === value.model) return
    onChange({
      ...value,
      model: rememberedModel,
    })
  }, [modelCandidates.lastSelectedModel, modelCandidates.loading, onChange, value])

  return (
    <>
      <Field label={providerLabel} htmlFor={providerId}>
        <Select
          id={providerId}
          fullWidth
          disabled={disabled}
          value={value.provider}
          onChange={(e) => {
            const nextProvider = e.target.value
            const sameProvider = nextProvider === value.provider
            if (!sameProvider) {
              const prev = value.provider.trim()
              const next = nextProvider.trim()
              pendingProviderRestoreRef.current = next || null
              if (prev) invalidateProviderModelsCache(prev)
              if (next) invalidateProviderModelsCache(next)
            }
            onChange({
              provider: nextProvider,
              model: sameProvider ? value.model : '',
              effort: sameProvider ? value.effort : '',
            })
          }}
        >
          {showProviderEmptyOption ? <option value="">{providerEmptyLabel}</option> : null}
          {providerOptions.map((id) => (
            <option key={id} value={id}>
              {providerOptionLabel(id)}
            </option>
          ))}
          {value.provider && !providerOptions.includes(value.provider) ? (
            <option value={value.provider}>{value.provider} (saved)</option>
          ) : null}
        </Select>
      </Field>
      <ExecutionProfileModelField
        value={value}
        onChange={onChange}
        onCommitModelSelection={rememberModelSelection}
        modelId={modelId}
        modelLabel={modelLabel}
        modelEmptyLabel={modelEmptyLabel}
        disabled={disabled}
        providerSelected={Boolean(value.provider.trim())}
        modelCandidates={modelCandidates}
        showCatalogHint={showCatalogHint}
        catalogModelCount={catalogModelCount}
      />
      {canShowEffort ? (
        <Field label={effortLabel} htmlFor={effortId} hint={effortHelp}>
          <Input
            id={effortId}
            list={effortListId}
            disabled={disabled}
            value={value.effort ?? ''}
            placeholder={effortEmptyLabel}
            onChange={(e) => onChange({ ...value, effort: e.target.value })}
          />
          <datalist id={effortListId}>
            {effortCandidates.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id} />
            ))}
          </datalist>
          {effortCandidates.candidates.length > 0 ? (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-1.5">
              {effortCandidates.candidates.map((candidate) => (
                <li
                  key={`${candidate.source}:${candidate.id}`}
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-[var(--color-surface-elevated)]"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-xs text-[var(--color-text)]"
                    disabled={disabled}
                    onClick={() => onChange({ ...value, effort: candidate.id })}
                  >
                    {candidate.id}
                  </button>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ${sourceBadgeClass(candidate.source)}`}
                  >
                    {candidate.source}
                  </span>
                  {candidate.source === 'history' ? (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                      aria-label={`Remove ${candidate.id} from history`}
                      disabled={disabled}
                      onClick={() => void effortCandidates.deleteHistoryItem(candidate.id)}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Field>
      ) : null}
    </>
  )
}
