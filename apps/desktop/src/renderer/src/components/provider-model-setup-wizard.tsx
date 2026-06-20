import { allowedProviderIdsFromConfig } from '@planetz/shared'
import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { invalidateProviderEffortsCache } from '../hooks/provider-effort-candidates-cache.js'
import { invalidateProviderModelsCache } from '../hooks/provider-model-candidates-cache.js'
import { useExecutionOptionSources } from '../hooks/use-execution-option-sources'
import {
  resolveAllowedProvidersForProfileFields,
  useVisibleProviderScope,
} from '../hooks/use-visible-provider-scope'
import { useI18n } from '../i18n'
import { ExecutionProfileFields } from './execution-profile-fields'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'

interface ProviderModelSetupWizardProps {
  open: boolean
  onSaved: () => void
  onRetrySources?: () => void
}

export function ProviderModelSetupWizard({
  open,
  onSaved,
  onRetrySources,
}: ProviderModelSetupWizardProps) {
  const { t } = useI18n()
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [allowedFromConfig, setAllowedFromConfig] = useState<readonly string[] | undefined>(
    undefined,
  )

  const executionOptions = useExecutionOptionSources({ reloadKey })

  const configuredProviders = useMemo(
    () => executionOptions.catalog?.configuredProviders ?? [],
    [executionOptions.catalog?.configuredProviders],
  )

  const { visibleProviderIds } = useVisibleProviderScope({
    allowedProviderIds: allowedFromConfig,
    configuredProviders,
    currentProvider: provider,
  })

  const allowedProviders = useMemo(
    () =>
      resolveAllowedProvidersForProfileFields({
        allowedFromConfig,
        visibleProviderIds,
      }),
    [allowedFromConfig, visibleProviderIds],
  )

  useEffect(() => {
    if (!open) return
    setProvider(executionOptions.engineConfig?.provider?.trim() ?? '')
    setModel(executionOptions.engineConfig?.model?.trim() ?? '')
    setError(null)
  }, [open, executionOptions.engineConfig?.provider, executionOptions.engineConfig?.model])

  useEffect(() => {
    if (!open) return
    void window.orbit.getSettings().then(({ config }) => {
      setAllowedFromConfig(allowedProviderIdsFromConfig(config?.ui))
    })
  }, [open])

  const profileSources = useMemo(
    () => ({
      engineConfig: executionOptions.engineConfig,
      catalog: executionOptions.catalog,
      currentProvider: provider,
      currentModel: model,
    }),
    [executionOptions, provider, model],
  )

  const canSave = provider.trim().length > 0 && model.trim().length > 0

  async function handleSave() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      await window.orbit.updateEngineConfig({
        provider: provider.trim(),
        model: model.trim(),
      })
      invalidateProviderModelsCache(provider.trim())
      invalidateProviderEffortsCache()
      setReloadKey((key) => key + 1)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {}}
      title={t('setupWizard.title')}
      description={t('setupWizard.description')}
      size="md"
      footer={
        <>
          {executionOptions.loadError ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                executionOptions.refresh()
                onRetrySources?.()
              }}
            >
              {t('setupWizard.retrySources')}
            </Button>
          ) : null}
          <Button
            variant="primary"
            disabled={!canSave || busy || executionOptions.loading}
            leading={<Settings2 size={13} />}
            onClick={() => void handleSave()}
          >
            {busy ? t('common.saving') : t('setupWizard.saveAndContinue')}
          </Button>
        </>
      }
    >
      <ExecutionProfileFields
        providerId="setup-wizard-provider"
        modelId="setup-wizard-model"
        providerLabel={t('setupWizard.providerLabel')}
        modelLabel={t('setupWizard.modelLabel')}
        providerEmptyLabel={t('setupWizard.providerEmpty')}
        modelEmptyLabel={t('setupWizard.modelEmpty')}
        value={{ provider, model }}
        sources={profileSources}
        reloadKey={reloadKey}
        showCatalogHint
        allowedProviders={allowedProviders}
        disabled={busy || executionOptions.loading}
        onChange={({ provider: nextProvider, model: nextModel }) => {
          setProvider(nextProvider)
          setModel(nextModel)
          if (error) setError(null)
        }}
      />
      {executionOptions.loadError ? (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          {t('setupWizard.sourcesLoadWarning', { error: executionOptions.loadError })}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-[var(--color-status-failed)]">{error}</p> : null}
      <p className="mt-3 text-xs text-[var(--color-muted)]">{t('setupWizard.settingsHint')}</p>
    </Dialog>
  )
}
