import type { CanonicalImportOffer, RecentWorkspace } from '@planetz/shared'
import {
  allowedProviderIdsFromConfig,
  isOrbitProviderId,
  ORBIT_DISPLAY_NAME,
  ORBIT_DISPLAY_ROOT,
  type OrbitProviderId,
  orbitProviderDisplayLabel,
  PRODUCT_DISPLAY_NAME,
  SIDECAR_DIR_NAME,
  sanitizeAllowedProviderIds,
  toDisplayOrbitPath,
} from '@planetz/shared'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FolderOpen,
  Layers,
  Loader2,
  Settings2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { invalidateProviderEffortsCache } from '../hooks/provider-effort-candidates-cache'
import { invalidateProviderModelsCache } from '../hooks/provider-model-candidates-cache'
import { useExecutionOptionSources } from '../hooks/use-execution-option-sources'
import {
  filterAllowedToVisibleProviders,
  useVisibleProviderScope,
} from '../hooks/use-visible-provider-scope'
import { useI18n } from '../i18n'
import { ExecutionProfileFields } from './execution-profile-fields'
import { ProductBrandIcon } from './product-brand-icon'
import { ProviderScopeChecklist } from './provider-scope-checklist'
import { Button } from './ui/button'

interface WorkspaceOnboardingProps {
  opening: boolean
  recentWorkspaces: RecentWorkspace[]
  workspacePath?: string | null
  canonicalImportOffer?: CanonicalImportOffer | null
  onOpenWorkspace: () => void
  onOpenRecentWorkspace: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace: (path: string) => Promise<void>
  onConfirmCanonicalImport?: (options: { importHomeGlobal?: boolean }) => Promise<void>
  onDismissCanonicalImport?: () => Promise<void>
  onSaveProviderModel?: (input: { provider: string; model: string }) => Promise<void>
}

type WizardStep = 1 | 2 | 3

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message.trim()
  if (typeof error === 'string' && error.trim().length > 0) return error.trim()
  return fallback
}

export function WorkspaceOnboarding({
  opening,
  recentWorkspaces,
  workspacePath = null,
  canonicalImportOffer = null,
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  onConfirmCanonicalImport,
  onDismissCanonicalImport,
  onSaveProviderModel,
}: WorkspaceOnboardingProps) {
  const { t } = useI18n()
  const workspaceSelected = Boolean(workspacePath?.trim())
  const [recentOpenError, setRecentOpenError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [step, setStep] = useState<WizardStep>(1)
  const [step1Busy, setStep1Busy] = useState(false)
  const [step2Busy, setStep2Busy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [importTakt, setImportTakt] = useState(false)
  const [importHomeGlobal, setImportHomeGlobal] = useState(false)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [allowedProviders, setAllowedProviders] = useState<OrbitProviderId[]>([])
  const [providerScopeTouched, setProviderScopeTouched] = useState(false)

  const executionOptions = useExecutionOptionSources({
    enabled: workspaceSelected,
    reloadKey,
  })

  const detectedProviders = useMemo<OrbitProviderId[]>(() => {
    const list = executionOptions.catalog?.runtimeDetectedProviders ?? []
    return list.filter(isOrbitProviderId)
  }, [executionOptions.catalog])

  const configuredProviders = useMemo<OrbitProviderId[]>(() => {
    const list = executionOptions.catalog?.configuredProviders ?? []
    return list.filter(isOrbitProviderId)
  }, [executionOptions.catalog])

  const { visibleProviderIds } = useVisibleProviderScope({
    allowedProviderIds: allowedProviders,
    configuredProviders,
    currentProvider: provider,
  })

  // Initialize allowedProviders from detected providers once catalog is loaded.
  useEffect(() => {
    if (providerScopeTouched) return
    setAllowedProviders(detectedProviders)
  }, [detectedProviders, providerScopeTouched])

  useEffect(() => {
    setProviderScopeTouched(false)
    setAllowedProviders([])
    if (!workspacePath?.trim()) return

    let cancelled = false
    void window.orbit.getSettings().then(({ config }) => {
      if (cancelled) return
      const fromConfig = allowedProviderIdsFromConfig(config?.ui)
      if (fromConfig) {
        setAllowedProviders(fromConfig)
        setProviderScopeTouched(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [workspacePath])

  useEffect(() => {
    if (step !== 3 || !provider.trim()) return
    if (!isOrbitProviderId(provider) || !allowedProviders.includes(provider)) {
      const fallback = allowedProviders[0] ?? ''
      setProvider(fallback)
      setModel('')
    }
  }, [step, allowedProviders, provider])

  const unavailableProviders = useMemo(
    () => allowedProviders.filter((id) => !detectedProviders.includes(id)),
    [allowedProviders, detectedProviders],
  )

  useEffect(() => {
    if (!workspaceSelected) {
      setProvider('')
      setModel('')
      return
    }
    setProvider(executionOptions.engineConfig?.provider?.trim() ?? '')
    setModel(executionOptions.engineConfig?.model?.trim() ?? '')
  }, [
    workspaceSelected,
    executionOptions.engineConfig?.provider,
    executionOptions.engineConfig?.model,
  ])

  useEffect(() => {
    setImportTakt(false)
    setImportHomeGlobal(false)
  }, [])

  const profileSources = useMemo(
    () => ({
      engineConfig: executionOptions.engineConfig,
      catalog: executionOptions.catalog,
      currentProvider: provider,
      currentModel: model,
    }),
    [executionOptions.engineConfig, executionOptions.catalog, provider, model],
  )

  const canProceedStep1 = workspaceSelected && !step1Busy && !opening
  const canProceedStep2 = workspaceSelected && allowedProviders.length > 0
  const canFinish =
    workspaceSelected &&
    provider.trim().length > 0 &&
    model.trim().length > 0 &&
    !saveBusy &&
    !executionOptions.loading

  async function handleStep1Next(): Promise<void> {
    setStepError(null)
    if (!workspaceSelected) {
      setStepError('Open a workspace before continuing.')
      return
    }

    if (!canonicalImportOffer) {
      setStep(2)
      return
    }

    setStep1Busy(true)
    try {
      if (importTakt) {
        if (!onConfirmCanonicalImport) {
          throw new Error('Import action is unavailable')
        }
        await onConfirmCanonicalImport({
          importHomeGlobal: canonicalImportOffer.homeGlobalAvailable ? importHomeGlobal : undefined,
        })
      } else {
        if (!onDismissCanonicalImport) {
          throw new Error('Skip import action is unavailable')
        }
        await onDismissCanonicalImport()
      }
      setStep(2)
    } catch (error: unknown) {
      setStepError(toErrorMessage(error, 'Failed to apply import settings'))
    } finally {
      setStep1Busy(false)
    }
  }

  async function persistProviderSelection(ids: OrbitProviderId[]): Promise<void> {
    const sanitized = sanitizeAllowedProviderIds(ids)
    if (sanitized.length === 0) {
      throw new Error('Select at least one provider')
    }
    await window.orbit.updateSettings({
      ui: { providerSelection: { allowedProviderIds: sanitized } },
    })
  }

  async function handleStep2Next(): Promise<void> {
    setStepError(null)
    if (!canProceedStep2) {
      setStepError(t('onboarding.providerScope.minOne'))
      return
    }
    setStep2Busy(true)
    try {
      await persistProviderSelection(allowedProviders)
      setStep(3)
    } catch (error: unknown) {
      setStepError(toErrorMessage(error, 'Failed to save provider selection'))
    } finally {
      setStep2Busy(false)
    }
  }

  function handleToggleProvider(id: OrbitProviderId, checked: boolean): void {
    setProviderScopeTouched(true)
    setStepError(null)
    setAllowedProviders((prev) => {
      const set = new Set(prev)
      if (checked) {
        set.add(id)
      } else {
        set.delete(id)
      }
      return filterAllowedToVisibleProviders([...set], visibleProviderIds)
    })
  }

  async function handleFinishSetup(): Promise<void> {
    setStepError(null)
    if (!canFinish) return
    if (!onSaveProviderModel) {
      setStepError('Save action is unavailable')
      return
    }
    setSaveBusy(true)
    try {
      await persistProviderSelection(allowedProviders)
      const nextProvider = provider.trim()
      const nextModel = model.trim()
      await onSaveProviderModel({ provider: nextProvider, model: nextModel })
      invalidateProviderModelsCache(nextProvider)
      invalidateProviderEffortsCache()
      setReloadKey((n) => n + 1)
    } catch (error: unknown) {
      setStepError(toErrorMessage(error, 'Failed to save provider/model defaults'))
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/70 p-8 shadow-xl shadow-black/40">
          <div className="mb-6 flex items-center gap-3">
            <ProductBrandIcon />
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-[var(--color-text-strong)]">
                {PRODUCT_DISPLAY_NAME}
              </h1>
              <p className="text-sm text-[var(--color-muted)]">{t('onboarding.tagline')}</p>
            </div>
            <StepIndicator step={step} />
          </div>

          {step === 1 ? (
            <Step1Workspace
              opening={opening}
              recentWorkspaces={recentWorkspaces}
              workspacePath={workspacePath}
              canonicalImportOffer={canonicalImportOffer}
              onOpenWorkspace={onOpenWorkspace}
              onOpenRecentWorkspace={onOpenRecentWorkspace}
              onRemoveRecentWorkspace={onRemoveRecentWorkspace}
              recentOpenError={recentOpenError}
              setRecentOpenError={setRecentOpenError}
              importTakt={importTakt}
              setImportTakt={setImportTakt}
              importHomeGlobal={importHomeGlobal}
              setImportHomeGlobal={setImportHomeGlobal}
            />
          ) : step === 2 ? (
            <Step2ProviderScope
              workspaceSelected={workspaceSelected}
              loading={executionOptions.loading}
              visibleProviderIds={visibleProviderIds}
              allowedProviders={allowedProviders}
              detectedProviders={detectedProviders}
              onToggle={handleToggleProvider}
              onSelectDetected={() => {
                setProviderScopeTouched(true)
                setAllowedProviders(
                  filterAllowedToVisibleProviders(detectedProviders, visibleProviderIds),
                )
              }}
              onSelectAll={() => {
                setProviderScopeTouched(true)
                setAllowedProviders([...visibleProviderIds])
              }}
              onClear={() => {
                setProviderScopeTouched(true)
                setAllowedProviders([])
              }}
            />
          ) : (
            <Step3ProviderModel
              workspaceSelected={workspaceSelected}
              provider={provider}
              model={model}
              onChange={(next) => {
                setProvider(next.provider)
                setModel(next.model)
                if (stepError) setStepError(null)
              }}
              sources={profileSources}
              loading={executionOptions.loading}
              loadError={executionOptions.loadError}
              reloadKey={reloadKey}
              allowedProviders={allowedProviders}
              unavailableProviders={unavailableProviders}
            />
          )}

          {stepError ? <p className="mt-4 text-xs text-[var(--color-alert)]">{stepError}</p> : null}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
            {step === 1 ? (
              <span className="text-xs text-[var(--color-muted)]">Step 1 of 3 · Workspace</span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                leading={<ArrowLeft size={13} />}
                onClick={() => setStep((step - 1) as WizardStep)}
                disabled={saveBusy || step2Busy}
              >
                Back
              </Button>
            )}
            {step === 1 ? (
              <Button
                variant="primary"
                size="sm"
                trailing={
                  step1Busy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ArrowRight size={13} />
                  )
                }
                onClick={() => void handleStep1Next()}
                disabled={!canProceedStep1}
              >
                {step1Busy ? 'Applying…' : 'Next'}
              </Button>
            ) : step === 2 ? (
              <Button
                variant="primary"
                size="sm"
                trailing={
                  step2Busy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ArrowRight size={13} />
                  )
                }
                onClick={() => void handleStep2Next()}
                disabled={!canProceedStep2 || step2Busy}
              >
                {step2Busy ? t('common.saving') : t('common.next')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leading={
                  saveBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />
                }
                disabled={!canFinish}
                onClick={() => void handleFinishSetup()}
              >
                {saveBusy ? 'Saving…' : 'Finish setup'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <ol className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider">
      <StepDot active={step === 1} done={step > 1} index={1} label="Workspace" />
      <span className="h-px w-6 bg-[var(--color-border)]" />
      <StepDot active={step === 2} done={step > 2} index={2} label="Providers" />
      <span className="h-px w-6 bg-[var(--color-border)]" />
      <StepDot active={step === 3} done={false} index={3} label="Default" />
    </ol>
  )
}

function StepDot({
  active,
  done,
  index,
  label,
}: {
  active: boolean
  done: boolean
  index: number
  label: string
}) {
  const dotClass = active
    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] border-[var(--color-accent)]'
    : done
      ? 'bg-[var(--color-status-completed-soft)] text-[var(--color-status-completed)] border-[var(--color-status-completed)]/50'
      : 'bg-[var(--color-panel)] text-[var(--color-muted)] border-[var(--color-border)]'
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${dotClass}`}
      >
        {done ? <Check size={11} /> : index}
      </span>
      <span
        className={
          active
            ? 'text-[var(--color-text-strong)]'
            : done
              ? 'text-[var(--color-status-completed)]'
              : 'text-[var(--color-muted)]'
        }
      >
        {label}
      </span>
    </li>
  )
}

interface Step1Props {
  opening: boolean
  recentWorkspaces: RecentWorkspace[]
  workspacePath: string | null
  canonicalImportOffer: CanonicalImportOffer | null
  onOpenWorkspace: () => void
  onOpenRecentWorkspace: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace: (path: string) => Promise<void>
  recentOpenError: string | null
  setRecentOpenError: (msg: string | null) => void
  importTakt: boolean
  setImportTakt: (v: boolean) => void
  importHomeGlobal: boolean
  setImportHomeGlobal: (v: boolean) => void
}

function Step1Workspace({
  opening,
  recentWorkspaces,
  workspacePath,
  canonicalImportOffer,
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  recentOpenError,
  setRecentOpenError,
  importTakt,
  setImportTakt,
  importHomeGlobal,
  setImportHomeGlobal,
}: Step1Props) {
  const { t } = useI18n()
  const workflowList =
    canonicalImportOffer && canonicalImportOffer.workflows.length > 0
      ? canonicalImportOffer.workflows.join(', ')
      : '(none)'

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--color-muted-strong)]">
        {t('onboarding.sidecarHint', {
          sidecarDir: toDisplayOrbitPath(`${SIDECAR_DIR_NAME}/`),
          orbitName: ORBIT_DISPLAY_NAME,
          orbitRoot: ORBIT_DISPLAY_ROOT,
        })}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={onOpenWorkspace}
          disabled={opening}
          leading={<FolderOpen size={15} />}
        >
          {opening ? t('onboarding.opening') : t('onboarding.openWorkspace')}
        </Button>
        {workspacePath ? (
          <p className="text-xs text-[var(--color-muted)]">
            Current: <span className="font-mono text-[var(--color-text)]">{workspacePath}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/70 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {t('common.recentWorkspaces')}
        </p>
        {recentWorkspaces.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">{t('common.noRecentWorkspaces')}</p>
        ) : (
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {recentWorkspaces.map((workspace) => (
              <li key={workspace.path} className="group flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-panel-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  title={workspace.path}
                  disabled={opening}
                  onClick={() => {
                    setRecentOpenError(null)
                    void onOpenRecentWorkspace(workspace.path).catch((error: unknown) => {
                      const message =
                        error instanceof Error ? error.message : t('common.failedToOpenWorkspace')
                      setRecentOpenError(message)
                    })
                  }}
                >
                  <span className="block truncate">{workspace.path}</span>
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] text-[var(--color-muted)] opacity-70 transition-opacity hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={opening}
                  onClick={() => {
                    setRecentOpenError(null)
                    void onRemoveRecentWorkspace(workspace.path)
                  }}
                  aria-label={t('common.removeWorkspaceAria', { path: workspace.path })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {recentOpenError ? (
          <p className="mt-2 text-xs text-[var(--color-alert)]">{recentOpenError}</p>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/70 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Download size={13} className="text-[var(--color-muted-strong)]" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Import from takt
          </p>
          <span className="ml-auto rounded-md bg-[var(--color-panel-strong)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
            optional
          </span>
        </div>
        {!workspacePath ? (
          <p className="text-xs text-[var(--color-muted-strong)]">
            Open a workspace first to detect importable takt settings.
          </p>
        ) : (
          <>
            {canonicalImportOffer ? (
              <>
                <p className="mb-2 text-xs text-[var(--color-muted-strong)]">
                  Detected importable settings in this workspace.
                </p>
                <ul className="mb-2 list-disc space-y-1 pl-4 text-xs text-[var(--color-text)]">
                  {canonicalImportOffer.engineConfig ? <li>Engine settings</li> : null}
                  {canonicalImportOffer.workflows.length > 0 ? (
                    <li>Workflow defaults ({workflowList})</li>
                  ) : null}
                </ul>
              </>
            ) : (
              <p className="mb-2 text-xs text-[var(--color-muted-strong)]">
                No importable takt settings were detected for this workspace.
              </p>
            )}
            <label
              className={`flex items-start gap-2 py-1 text-xs ${
                canonicalImportOffer
                  ? 'cursor-pointer text-[var(--color-text)]'
                  : 'cursor-not-allowed text-[var(--color-muted)]'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={importTakt}
                disabled={!canonicalImportOffer}
                onChange={(e) => setImportTakt(e.target.checked)}
              />
              <span>Import detected takt settings (engine config + workflows)</span>
            </label>
            <label
              className={`flex items-start gap-2 py-1 text-xs ${
                importTakt && canonicalImportOffer?.homeGlobalAvailable
                  ? 'cursor-pointer text-[var(--color-text)]'
                  : 'cursor-not-allowed text-[var(--color-muted)]'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={importHomeGlobal}
                disabled={!importTakt || !canonicalImportOffer?.homeGlobalAvailable}
                onChange={(e) => setImportHomeGlobal(e.target.checked)}
              />
              <span>
                Also import global <span className="font-mono">~/.takt</span> settings
              </span>
            </label>
          </>
        )}
      </div>
    </div>
  )
}

interface Step2ProviderScopeProps {
  workspaceSelected: boolean
  loading: boolean
  visibleProviderIds: ReadonlyArray<OrbitProviderId>
  allowedProviders: ReadonlyArray<string>
  detectedProviders: ReadonlyArray<string>
  onToggle: (id: OrbitProviderId, checked: boolean) => void
  onSelectDetected: () => void
  onSelectAll: () => void
  onClear: () => void
}

function Step2ProviderScope({
  workspaceSelected,
  loading,
  visibleProviderIds,
  allowedProviders,
  detectedProviders,
  onToggle,
  onSelectDetected,
  onSelectAll,
  onClear,
}: Step2ProviderScopeProps) {
  const { t } = useI18n()
  const allowedCount = allowedProviders.length

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 text-sm text-[var(--color-muted-strong)]">
        <Layers size={14} className="mt-0.5 text-[var(--color-muted-strong)]" />
        <div>
          <p className="text-[var(--color-text)]">{t('onboarding.providerScope.title')}</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {t('onboarding.providerScope.description')}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/70 p-4">
        {!workspaceSelected ? (
          <p className="text-xs text-[var(--color-muted)]">
            {t('onboarding.providerScope.openWorkspaceFirst')}
          </p>
        ) : loading ? (
          <p className="text-xs text-[var(--color-muted)]">
            {t('onboarding.providerScope.loading')}
          </p>
        ) : (
          <>
            <ProviderScopeChecklist
              visibleProviderIds={visibleProviderIds}
              allowedProviderIds={allowedProviders}
              detectedProviderIds={detectedProviders}
              onToggle={onToggle}
              onSelectDetected={onSelectDetected}
              onSelectAll={onSelectAll}
              onClear={onClear}
            />
            {allowedCount === 0 ? (
              <p className="mt-3 text-xs text-[var(--color-alert)]">
                {t('onboarding.providerScope.minOne')}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

interface Step3Props {
  workspaceSelected: boolean
  provider: string
  model: string
  onChange: (next: { provider: string; model: string }) => void
  sources: Parameters<typeof ExecutionProfileFields>[0]['sources']
  loading: boolean
  loadError: string | null
  reloadKey: number
  allowedProviders: ReadonlyArray<string>
  unavailableProviders: ReadonlyArray<string>
}

function Step3ProviderModel({
  workspaceSelected,
  provider,
  model,
  onChange,
  sources,
  loading,
  loadError,
  reloadKey,
  allowedProviders,
  unavailableProviders,
}: Step3Props) {
  const { t } = useI18n()

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 text-sm text-[var(--color-muted-strong)]">
        <Settings2 size={14} className="mt-0.5 text-[var(--color-muted-strong)]" />
        <p>{t('setupWizard.description')}</p>
      </div>

      {unavailableProviders.length > 0 ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {t('onboarding.providerScope.notExecutable', {
                providers: unavailableProviders
                  .map((id) =>
                    isOrbitProviderId(id) ? `${orbitProviderDisplayLabel(id)} (${id})` : id,
                  )
                  .join(', '),
              })}
            </p>
            <p className="mt-0.5 opacity-90">{t('onboarding.providerScope.notExecutableHint')}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/70 p-4">
        <ExecutionProfileFields
          providerId="onboarding-provider"
          modelId="onboarding-model"
          value={{ provider, model }}
          sources={sources}
          reloadKey={reloadKey}
          disabled={!workspaceSelected || loading}
          providerLabel={t('setupWizard.providerLabel')}
          modelLabel={t('setupWizard.modelLabel')}
          providerEmptyLabel={t('setupWizard.providerEmpty')}
          modelEmptyLabel={t('setupWizard.modelEmpty')}
          showCatalogHint
          allowedProviders={allowedProviders}
          onChange={(next) => onChange({ provider: next.provider, model: next.model })}
        />

        {!workspaceSelected ? (
          <p className="text-xs text-[var(--color-muted)]">
            Open a workspace before configuring provider/model.
          </p>
        ) : null}
        {loading ? (
          <p className="text-xs text-[var(--color-muted)]">{t('setupWizard.preparingExecution')}</p>
        ) : null}
        {loadError ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t('setupWizard.sourcesLoadWarning', { error: loadError })}
          </p>
        ) : null}
        <p className="text-xs text-[var(--color-muted)]">{t('setupWizard.settingsHint')}</p>
      </div>
    </div>
  )
}
