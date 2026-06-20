import {
  allowedProviderIdsFromConfig,
  buildEngineConfigForSave,
  DEFAULT_ENGINE_CONCURRENCY,
  DEFAULT_OLLAMA_TOOLS_GUARD,
  type EngineConfig,
  engineConfigForFormState,
  type OllamaToolsGuardMode,
  personaProvidersToRows,
  type RateLimitSwitchEntry,
  readEffortFromEngineConfig,
  switchChainFromEngineConfig,
  writeEffortToEngineConfig,
} from '@planetz/shared'
import { Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invalidateProviderEffortsCache } from '../../hooks/provider-effort-candidates-cache.js'
import { invalidateProviderModelsCache } from '../../hooks/provider-model-candidates-cache.js'
import { useExecutionOptionSources } from '../../hooks/use-execution-option-sources'
import {
  resolveAllowedProvidersForProfileFields,
  useVisibleProviderScope,
} from '../../hooks/use-visible-provider-scope'
import { useAppStore } from '../../store/app-store'
import { ExecutionProfileFields } from '../execution-profile-fields'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'
import { EngineConfigPassthroughEditor } from './engine-config-passthrough-editor'
import { OllamaConnectionFields } from './ollama-connection-fields.js'
import { RateLimitSwitchChainEditor } from './rate-limit-switch-chain-editor.js'

/** Debounce before persisting engine config after form edits. */
const ENGINE_CONFIG_SAVE_DEBOUNCE_MS = 800

type ImportSource = 'workspace-takt' | 'home-global'
type ImportMode = 'merge' | 'overwrite'

function formSnapshot(formConfig: EngineConfig, switchChain: RateLimitSwitchEntry[]): string {
  return JSON.stringify({ formConfig, switchChain })
}

export function OrbitEngineConfigPanel() {
  const uiLanguage = useAppStore((s) => s.uiLanguage)
  const [formConfig, setFormConfig] = useState<EngineConfig | null>(null)
  const [switchChain, setSwitchChain] = useState<RateLimitSwitchEntry[]>([])
  const [passthroughSyncKey, setPassthroughSyncKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [importSource, setImportSource] = useState<ImportSource>('workspace-takt')
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [allowedFromConfig, setAllowedFromConfig] = useState<readonly string[] | undefined>(
    undefined,
  )
  const [toolsGuard, setToolsGuard] = useState<OllamaToolsGuardMode>(DEFAULT_OLLAMA_TOOLS_GUARD)
  const persistedSnapshotRef = useRef<string | null>(null)
  const skipNextAutoSaveRef = useRef(false)

  const applyLoadedConfig = useCallback((config: EngineConfig) => {
    setFormConfig(engineConfigForFormState(config))
    setSwitchChain(switchChainFromEngineConfig(config))
    setPassthroughSyncKey((key) => key + 1)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [result, settings] = await Promise.all([
        window.orbit.getEngineConfig(),
        window.orbit.getSettings(),
      ])
      applyLoadedConfig(result.config)
      setToolsGuard(settings.config?.ui.ollama?.toolsGuard ?? DEFAULT_OLLAMA_TOOLS_GUARD)
      skipNextAutoSaveRef.current = true
    } catch (err) {
      setFormConfig(null)
      persistedSnapshotRef.current = null
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [applyLoadedConfig])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void window.orbit.getSettings().then(({ config }) => {
      setAllowedFromConfig(allowedProviderIdsFromConfig(config?.ui))
    })
  }, [])

  const optionSources = useExecutionOptionSources({ reloadKey: savedAt ?? 0 })

  const configuredProviders = useMemo(
    () => optionSources.catalog?.configuredProviders ?? [],
    [optionSources.catalog?.configuredProviders],
  )

  const { visibleProviderIds } = useVisibleProviderScope({
    allowedProviderIds: allowedFromConfig,
    configuredProviders,
    currentProvider: formConfig?.provider,
  })

  const allowedProviders = useMemo(
    () =>
      resolveAllowedProvidersForProfileFields({
        allowedFromConfig,
        visibleProviderIds,
      }),
    [allowedFromConfig, visibleProviderIds],
  )

  const persistEngineConfig = useCallback(async () => {
    if (!formConfig) return false
    setBusy(true)
    setError(null)
    try {
      // Preserve the latest persona routing from disk; this panel no longer edits persona_providers.
      const { config: currentConfig } = await window.orbit.getEngineConfig()
      const patch = buildEngineConfigForSave({
        formConfig,
        personaRows: personaProvidersToRows(currentConfig.persona_providers),
        switchChain,
        uiLanguage,
      })
      const result = await window.orbit.updateEngineConfig(patch)
      applyLoadedConfig(result.config)
      skipNextAutoSaveRef.current = true
      setSavedAt(Date.now())
      invalidateProviderModelsCache()
      invalidateProviderEffortsCache()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }, [applyLoadedConfig, formConfig, switchChain, uiLanguage])

  const savePayload = useMemo(() => {
    if (!formConfig) return null
    return formSnapshot(formConfig, switchChain)
  }, [formConfig, switchChain])

  useEffect(() => {
    if (!savePayload || loading) return

    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      persistedSnapshotRef.current = savePayload
      return
    }

    if (persistedSnapshotRef.current === null) {
      persistedSnapshotRef.current = savePayload
      return
    }

    if (persistedSnapshotRef.current === savePayload) return

    const timer = setTimeout(() => {
      void persistEngineConfig()
    }, ENGINE_CONFIG_SAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [savePayload, loading, persistEngineConfig])

  async function handleReimport(overwrite: boolean) {
    setBusy(true)
    setError(null)
    try {
      const result = await window.orbit.importEngineConfigFromTakt({ overwrite })
      if (!result.overwritten && overwrite === false) {
        setError('Engine config already exists — enable overwrite to replace from .takt')
        return
      }
      await load()
      invalidateProviderModelsCache()
      invalidateProviderEffortsCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleImportHomeGlobal(overwrite: boolean) {
    setBusy(true)
    setError(null)
    try {
      const result = await window.orbit.importGlobalTaktFromHome({ overwrite })
      if (!result.configImported && result.workflowsImported.length === 0) {
        setError('Nothing to import from ~/.takt (missing or already present without overwrite)')
        return
      }
      await load()
      invalidateProviderModelsCache()
      invalidateProviderEffortsCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    const overwrite = importMode === 'overwrite'
    if (importSource === 'workspace-takt') {
      await handleReimport(overwrite)
    } else {
      await handleImportHomeGlobal(overwrite)
    }
  }

  const profileSources = formConfig
    ? {
        engineConfig: formConfig,
        catalog: optionSources.catalog,
        currentProvider: formConfig.provider,
        currentModel: formConfig.model,
      }
    : {
        engineConfig: optionSources.engineConfig,
        catalog: optionSources.catalog,
      }

  if (loading && !formConfig) {
    return <p className="text-xs text-[var(--color-muted)]">Loading Orbit engine config…</p>
  }

  if (!formConfig) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <p className="text-xs text-[var(--color-status-failed)]">
          Failed to load Orbit engine config: {error ?? 'Unknown error'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading || busy}>
            {loading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      </div>
    )
  }

  const saveStatus = busy ? 'Saving…' : savedAt ? 'Saved' : null

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-xs text-[var(--color-muted)]">
        Set the default provider/model and rate-limit fallback for this workspace. Changes save
        automatically. Language is managed in Settings → General.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <ExecutionProfileFields
          providerId="engine-provider"
          modelId="engine-model"
          effortId="engine-effort"
          providerLabel="Default provider"
          modelLabel="Default model"
          effortLabel="Default effort"
          showCatalogHint
          allowedProviders={allowedProviders}
          value={{
            provider: formConfig.provider ?? '',
            model: formConfig.model ?? '',
            effort: readEffortFromEngineConfig(formConfig) ?? '',
          }}
          sources={profileSources}
          reloadKey={savedAt ?? 0}
          disabled={busy || optionSources.loading}
          onChange={({ provider, model, effort }) =>
            setFormConfig(
              writeEffortToEngineConfig(
                {
                  ...formConfig,
                  provider: provider || undefined,
                  model: model || undefined,
                },
                effort,
              ),
            )
          }
        />
        <Field label="Concurrency" htmlFor="engine-concurrency">
          <Input
            id="engine-concurrency"
            type="number"
            min={1}
            max={10}
            value={formConfig.concurrency ?? DEFAULT_ENGINE_CONCURRENCY}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              setFormConfig({
                ...formConfig,
                concurrency: Number.isFinite(n) ? n : DEFAULT_ENGINE_CONCURRENCY,
              })
            }}
          />
        </Field>
      </div>

      {formConfig.provider === 'ollama' ? (
        <OllamaConnectionFields
          formConfig={formConfig}
          onFormConfigChange={setFormConfig}
          toolsGuard={toolsGuard}
          onToolsGuardChange={async (mode) => {
            const updated = await window.orbit.updateSettings({
              ui: { ollama: { toolsGuard: mode } },
            })
            setToolsGuard(updated.config.ui.ollama?.toolsGuard ?? mode)
          }}
          disabled={busy}
        />
      ) : null}

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
          persona_providers
        </h3>
        <p className="text-[11px] text-[var(--color-muted)]">
          Persona routing is edited in Settings → Facets (select a persona key). This engine-config
          remains the save target for runtime provider/model routes.
        </p>
      </section>

      <EngineConfigPassthroughEditor
        key={passthroughSyncKey}
        config={formConfig}
        onConfigChange={setFormConfig}
      />

      <RateLimitSwitchChainEditor
        chain={switchChain}
        onChainChange={setSwitchChain}
        profileSources={profileSources}
        reloadKey={savedAt ?? 0}
        disabled={busy}
      />

      {error ? <p className="text-xs text-[var(--color-status-failed)]">{error}</p> : null}
      {saveStatus ? (
        <p
          className={
            saveStatus === 'Saved'
              ? 'text-[11px] text-[var(--color-status-done)]'
              : 'text-[11px] text-[var(--color-muted)]'
          }
        >
          {saveStatus}
        </p>
      ) : null}

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Import settings
        </p>
        <div className="flex flex-col gap-3 text-xs">
          <fieldset className="flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-0.5 text-[11px] font-medium text-[var(--color-muted-strong)]">
              Source
            </legend>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="engine-import-source"
                checked={importSource === 'workspace-takt'}
                disabled={busy}
                onChange={() => setImportSource('workspace-takt')}
              />
              Workspace .takt (isolated execution repo)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="engine-import-source"
                checked={importSource === 'home-global'}
                disabled={busy}
                onChange={() => setImportSource('home-global')}
              />
              Global ~/.takt
            </label>
          </fieldset>
          <fieldset className="flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-0.5 text-[11px] font-medium text-[var(--color-muted-strong)]">
              If settings already exist
            </legend>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="engine-import-mode"
                checked={importMode === 'merge'}
                disabled={busy}
                onChange={() => setImportMode('merge')}
              />
              Keep existing (skip import)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="engine-import-mode"
                checked={importMode === 'overwrite'}
                disabled={busy}
                onChange={() => setImportMode('overwrite')}
              />
              Overwrite with imported values
            </label>
          </fieldset>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leading={<Download size={13} />}
            disabled={busy}
            onClick={() => void handleImport()}
          >
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </section>
    </div>
  )
}
