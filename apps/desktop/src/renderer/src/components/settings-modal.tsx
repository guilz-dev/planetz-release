import {
  type AgentState,
  type AvailableThemeId,
  type ComposerAssistDefaultMode,
  type IntegrationsState,
  normalizeUiPreferences,
  type OrbitProviderId,
  sanitizeAllowedProviderIds,
  type UiConfig,
  type UiLanguage,
} from '@planetz/shared'
import { Bot, Cable, Cog, FileDiff, Layers, Sliders } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useAllowedProvidersForSettingsEditor } from '../hooks/use-provider-selection'
import { useI18n } from '../i18n'
import { useAppStore } from '../store/app-store'
import { syncUiPreferencesFromConfig } from '../store/sync-ui-preferences'
import { AgentConfigPanel } from './settings/agent-config-panel'
import { OrbitEngineConfigPanel } from './settings/orbit-engine-config-panel'
import { type FacetSelection, SettingsFacetsPanel } from './settings/settings-facets-panel'
import { SettingsGeneral } from './settings/settings-general'
import { SettingsIntegrations } from './settings/settings-integrations'
import { SettingsProvidersPanel } from './settings/settings-providers-panel'
import { Button } from './ui/button'
import { cn } from './ui/cn'
import { Dialog } from './ui/dialog'
import { ExperimentalBadge } from './ui/experimental-badge'

export type SettingsTab = 'general' | 'providers' | 'facets' | 'engine' | 'agents' | 'integrations'

interface SettingsModalProps {
  open: boolean
  workspacePath: string | null
  taktExecutionPath?: string | null
  config: UiConfig | null
  agents: AgentState[]
  integrations: IntegrationsState
  onClose: () => void
  onSaved: () => void | Promise<void>
  hookBearerSecret: string | null
  onDismissHookBearerSecret: () => void
  onToggleHookServer: (input: {
    enabled: boolean
    port?: number
  }) => Promise<{ bearerSecret?: string }>
  onToggleAdapter: (id: 'cursor' | 'codex' | 'claude', enabled: boolean) => Promise<void>
  onPushAdapter: (id: 'cursor' | 'codex' | 'claude') => Promise<void>
  onSelectWorkspace: () => Promise<void> | void
  initialTab?: SettingsTab | null
  /** Pre-select a facet when opening the Facets tab (e.g. from Workflows → Edit in Facets). */
  initialFacetSelection?: FacetSelection | null
  /** From Facets or Engine/Agents: close settings and show the workflow view (optional facet filter). */
  onNavigateToWorkflowView?: (filter?: FacetSelection | null) => void | Promise<void>
}

export function SettingsModal({
  open,
  workspacePath,
  taktExecutionPath = null,
  config,
  agents,
  integrations,
  onClose,
  onSaved,
  hookBearerSecret,
  onDismissHookBearerSecret,
  onToggleHookServer,
  onToggleAdapter,
  onPushAdapter,
  onSelectWorkspace,
  initialTab = null,
  initialFacetSelection = null,
  onNavigateToWorkflowView,
}: SettingsModalProps) {
  const { t } = useI18n()
  const [tab, setTab] = useState<SettingsTab>('general')
  const [facetSelection, setFacetSelection] = useState<FacetSelection | null>(null)
  const [watchAutoStart, setWatchAutoStart] = useState(true)
  const [theme, setTheme] = useState<AvailableThemeId>('default')
  const [counterPackEnabled, setCounterPackEnabled] = useState(false)
  const [language, setLanguage] = useState<UiLanguage>('en')
  const [composerAssistDefaultMode, setComposerAssistDefaultMode] =
    useState<ComposerAssistDefaultMode>('direct')
  const [workflowLowConfidenceGateEnabled, setWorkflowLowConfidenceGateEnabled] = useState(false)
  const [allowedProviderIds, setAllowedProviderIds] = useState<OrbitProviderId[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configAllowedProviderIds = useAllowedProvidersForSettingsEditor(config)

  function handleCloseWithoutSave(): void {
    onClose()
  }

  useEffect(() => {
    if (!config) return
    setWatchAutoStart(config.watch.autoStart)
    const ui = normalizeUiPreferences(config.ui)
    setTheme(ui.theme)
    setCounterPackEnabled(ui.counterPackEnabled)
    setLanguage(ui.language)
    setComposerAssistDefaultMode(ui.composerAssistDefaultMode)
    setWorkflowLowConfidenceGateEnabled(ui.workflowLowConfidenceGateEnabled)
    setAllowedProviderIds(configAllowedProviderIds)
    setError(null)
  }, [config, configAllowedProviderIds])

  useEffect(() => {
    if (!open) return
    syncUiPreferencesFromConfig(config)
  }, [open, config])

  useEffect(() => {
    if (!open || !initialTab) return
    setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open || !initialFacetSelection) return
    setFacetSelection(initialFacetSelection)
    setTab('facets')
  }, [open, initialFacetSelection])

  useEffect(() => {
    if (open) return
    setTab('general')
    setFacetSelection(null)
  }, [open])

  async function handleSaveProvidersPatch(nextIds: OrbitProviderId[]): Promise<void> {
    const sanitized = sanitizeAllowedProviderIds(nextIds)
    if (sanitized.length === 0) return

    const previous = allowedProviderIds
    setAllowedProviderIds(sanitized)
    setBusy(true)
    setError(null)
    try {
      const result = await window.orbit.updateSettings({
        ui: { providerSelection: { allowedProviderIds: sanitized } },
      })
      setAllowedProviderIds(result.config.ui.providerSelection?.allowedProviderIds ?? sanitized)
      void Promise.resolve(onSaved())
    } catch (err) {
      setAllowedProviderIds(previous)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveGeneralPatch(patch: {
    watchAutoStart?: boolean
    theme?: AvailableThemeId
    counterPackEnabled?: boolean
    language?: UiLanguage
    composerAssistDefaultMode?: ComposerAssistDefaultMode
    workflowLowConfidenceGateEnabled?: boolean
  }) {
    const previous = {
      watchAutoStart,
      theme,
      counterPackEnabled,
      language,
      composerAssistDefaultMode,
      workflowLowConfidenceGateEnabled,
    }
    const next = {
      watchAutoStart: patch.watchAutoStart ?? previous.watchAutoStart,
      theme: patch.theme ?? previous.theme,
      counterPackEnabled: patch.counterPackEnabled ?? previous.counterPackEnabled,
      language: patch.language ?? previous.language,
      composerAssistDefaultMode:
        patch.composerAssistDefaultMode ?? previous.composerAssistDefaultMode,
      workflowLowConfidenceGateEnabled:
        patch.workflowLowConfidenceGateEnabled ?? previous.workflowLowConfidenceGateEnabled,
    }
    setWatchAutoStart(next.watchAutoStart)
    setTheme(next.theme)
    setCounterPackEnabled(next.counterPackEnabled)
    setLanguage(next.language)
    setComposerAssistDefaultMode(next.composerAssistDefaultMode)
    setWorkflowLowConfidenceGateEnabled(next.workflowLowConfidenceGateEnabled)
    useAppStore.getState().setUiPreferences({
      themeId: next.theme,
      counterPackEnabled: next.counterPackEnabled,
      uiLanguage: next.language,
      composerAssistDefaultMode: next.composerAssistDefaultMode,
      workflowLowConfidenceGateEnabled: next.workflowLowConfidenceGateEnabled,
    })

    const uiPatch: {
      theme?: AvailableThemeId
      counterPackEnabled?: boolean
      language?: UiLanguage
      composerAssistDefaultMode?: ComposerAssistDefaultMode
      workflowLowConfidenceGateEnabled?: boolean
    } = {}
    if (patch.theme !== undefined) uiPatch.theme = patch.theme
    if (patch.counterPackEnabled !== undefined)
      uiPatch.counterPackEnabled = patch.counterPackEnabled
    if (patch.language !== undefined) uiPatch.language = patch.language
    if (patch.composerAssistDefaultMode !== undefined) {
      uiPatch.composerAssistDefaultMode = patch.composerAssistDefaultMode
    }
    if (patch.workflowLowConfidenceGateEnabled !== undefined) {
      uiPatch.workflowLowConfidenceGateEnabled = patch.workflowLowConfidenceGateEnabled
    }

    const updatePatch: {
      watch?: { autoStart: boolean }
      ui?: {
        theme?: AvailableThemeId
        counterPackEnabled?: boolean
        language?: UiLanguage
        composerAssistDefaultMode?: ComposerAssistDefaultMode
        workflowLowConfidenceGateEnabled?: boolean
      }
    } = {}
    if (patch.watchAutoStart !== undefined) {
      updatePatch.watch = { autoStart: patch.watchAutoStart }
    }
    if (Object.keys(uiPatch).length > 0) {
      updatePatch.ui = uiPatch
    }

    setBusy(true)
    setError(null)
    try {
      const result = await window.orbit.updateSettings(updatePatch)
      setWatchAutoStart(result.config.watch.autoStart)
      const normalizedUi = normalizeUiPreferences(result.config.ui)
      setTheme(normalizedUi.theme)
      setCounterPackEnabled(normalizedUi.counterPackEnabled)
      setLanguage(normalizedUi.language)
      setComposerAssistDefaultMode(normalizedUi.composerAssistDefaultMode)
      setWorkflowLowConfidenceGateEnabled(normalizedUi.workflowLowConfidenceGateEnabled)
      syncUiPreferencesFromConfig(result.config)
      void Promise.resolve(onSaved())
    } catch (err) {
      setWatchAutoStart(previous.watchAutoStart)
      setTheme(previous.theme)
      setCounterPackEnabled(previous.counterPackEnabled)
      setLanguage(previous.language)
      setComposerAssistDefaultMode(previous.composerAssistDefaultMode)
      setWorkflowLowConfidenceGateEnabled(previous.workflowLowConfidenceGateEnabled)
      useAppStore.getState().setUiPreferences({
        themeId: previous.theme,
        counterPackEnabled: previous.counterPackEnabled,
        uiLanguage: previous.language,
        composerAssistDefaultMode: previous.composerAssistDefaultMode,
        workflowLowConfidenceGateEnabled: previous.workflowLowConfidenceGateEnabled,
      })
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const navItems: ReadonlyArray<{ value: SettingsTab; label: ReactNode; icon: ReactNode }> = [
    { value: 'general', label: t('settings.tabs.general'), icon: <Sliders size={14} /> },
    { value: 'providers', label: t('settings.tabs.providers'), icon: <Layers size={14} /> },
    { value: 'facets', label: t('settings.tabs.facets'), icon: <FileDiff size={14} /> },
    { value: 'engine', label: t('settings.tabs.engine'), icon: <Cog size={14} /> },
    { value: 'agents', label: t('settings.tabs.agents'), icon: <Bot size={14} /> },
    {
      value: 'integrations',
      label: (
        <span className="inline-flex items-center gap-1.5">
          {t('settings.tabs.integrations')}
          <ExperimentalBadge short />
        </span>
      ),
      icon: <Cable size={14} />,
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={handleCloseWithoutSave}
      title={t('settings.title')}
      description={t('settings.description')}
      size="full"
      bodyClassName="flex min-h-0 flex-row"
      footer={
        tab === 'general' || tab === 'providers' ? (
          <>
            {error ? (
              <p className="mr-auto text-xs text-[var(--color-status-failed)]">{error}</p>
            ) : null}
            {busy ? (
              <p className="text-xs text-[var(--color-muted)]">{t('common.saving')}</p>
            ) : null}
            <Button variant="ghost" onClick={handleCloseWithoutSave} disabled={busy}>
              {t('common.close')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={handleCloseWithoutSave}>
            {t('common.close')}
          </Button>
        )
      }
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3"
      >
        {navItems.map((item) => {
          const active = item.value === tab
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.value)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors',
                active
                  ? 'bg-[var(--color-surface-elevated)] text-[var(--color-text-strong)] shadow-sm shadow-black/20'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]',
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex min-w-0 flex-1 overflow-auto px-5 py-4">
        <div className="min-w-0 flex-1">
          {tab === 'general' ? (
            <SettingsGeneral
              workspacePath={workspacePath}
              taktExecutionPath={taktExecutionPath}
              watchAutoStart={watchAutoStart}
              theme={theme}
              counterPackEnabled={counterPackEnabled}
              language={language}
              composerAssistDefaultMode={composerAssistDefaultMode}
              workflowLowConfidenceGateEnabled={workflowLowConfidenceGateEnabled}
              disabled={busy}
              onChange={(patch) => void handleSaveGeneralPatch(patch)}
              onSelectWorkspace={onSelectWorkspace}
            />
          ) : null}

          {tab === 'providers' ? (
            <SettingsProvidersPanel
              config={config}
              disabled={busy}
              onChange={(ids) => void handleSaveProvidersPatch(ids)}
            />
          ) : null}

          {tab === 'facets' ? (
            <SettingsFacetsPanel
              initialSelection={facetSelection}
              onOpenWorkflows={async (filter) => {
                await onNavigateToWorkflowView?.(filter ?? null)
              }}
            />
          ) : null}

          {tab === 'engine' ? <OrbitEngineConfigPanel /> : null}

          {tab === 'agents' ? (
            <AgentConfigPanel
              agents={agents}
              onOpenWorkflows={
                onNavigateToWorkflowView ? () => void onNavigateToWorkflowView() : undefined
              }
            />
          ) : null}

          {tab === 'integrations' ? (
            <SettingsIntegrations
              integrations={integrations}
              hookBearerSecret={hookBearerSecret}
              onDismissBearerSecret={onDismissHookBearerSecret}
              onToggleHookServer={onToggleHookServer}
              onToggleAdapter={onToggleAdapter}
              onPushAdapter={onPushAdapter}
            />
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
