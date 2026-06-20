import {
  isOrbitProviderId,
  type OrbitProviderId,
  orbitProviderDisplayLabel,
  type UiConfig,
} from '@planetz/shared'
import { AlertTriangle, Layers, RefreshCw } from 'lucide-react'
import { invalidateProviderEffortsCache } from '../../hooks/provider-effort-candidates-cache'
import { invalidateProviderModelsCache } from '../../hooks/provider-model-candidates-cache'
import {
  useAllowedProvidersForSettingsEditor,
  useProviderCatalogSnapshot,
  useUnavailableAllowedProviders,
} from '../../hooks/use-provider-selection'
import {
  filterAllowedToVisibleProviders,
  useVisibleProviderScope,
} from '../../hooks/use-visible-provider-scope'
import { useI18n } from '../../i18n'
import { ProviderScopeChecklist } from '../provider-scope-checklist'
import { Button } from '../ui/button'

interface SettingsProvidersPanelProps {
  config: UiConfig | null
  disabled?: boolean
  onChange: (allowedProviderIds: OrbitProviderId[]) => void
}

export function SettingsProvidersPanel({
  config,
  disabled = false,
  onChange,
}: SettingsProvidersPanelProps) {
  const { t } = useI18n()
  const providerCatalog = useProviderCatalogSnapshot(Boolean(config))
  const {
    devProvidersAvailable,
    showDevProviders,
    setShowDevProviders,
    visibleProviderIds,
    retainDevProviderIds,
  } = useVisibleProviderScope({
    allowedProviderIds: config?.ui?.providerSelection?.allowedProviderIds,
    configuredProviders: providerCatalog.configuredProviders,
  })
  const allowedProviders = useAllowedProvidersForSettingsEditor(config, {
    includeDevProviders: devProvidersAvailable && showDevProviders,
    retainProviderIds: retainDevProviderIds,
  })

  const unavailableProviders = useUnavailableAllowedProviders({
    allowedProviderIds: allowedProviders,
    detectedProviderIds: providerCatalog.detectedProviders,
  })

  const tooFewAllowed = allowedProviders.length === 0

  function handleToggle(id: OrbitProviderId, checked: boolean): void {
    const next = new Set(allowedProviders)
    if (checked) next.add(id)
    else next.delete(id)
    onChange(filterAllowedToVisibleProviders([...next], visibleProviderIds))
  }

  function handleRefresh(): void {
    invalidateProviderModelsCache()
    invalidateProviderEffortsCache()
    providerCatalog.refresh()
  }

  const initialLoading = config === null
  const refreshing = config !== null && providerCatalog.loading
  const refreshDisabled = disabled || initialLoading || refreshing

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-[var(--color-muted-strong)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
              {t('settings.providers.title')}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leading={<RefreshCw size={12} />}
            loading={refreshing}
            disabled={refreshDisabled}
            onClick={handleRefresh}
          >
            {refreshing ? t('settings.providers.refreshing') : t('settings.providers.refresh')}
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {t('settings.providers.description')}
        </p>
        {providerCatalog.loadError ? (
          <p className="mt-1 text-[11px] text-[var(--color-alert)]">{providerCatalog.loadError}</p>
        ) : null}
      </header>

      {initialLoading ? (
        <p className="text-xs text-[var(--color-muted)]">{t('settings.providers.loading')}</p>
      ) : (
        <>
          {unavailableProviders.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {t('settings.providers.notExecutable', {
                    providers: unavailableProviders
                      .map((id) =>
                        isOrbitProviderId(id) ? `${orbitProviderDisplayLabel(id)} (${id})` : id,
                      )
                      .join(', '),
                  })}
                </p>
                <p className="mt-0.5 opacity-90">{t('settings.providers.notExecutableHint')}</p>
              </div>
            </div>
          ) : null}

          {tooFewAllowed ? (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-alert)]/40 bg-[var(--color-alert)]/10 px-3 py-2 text-xs text-[var(--color-alert)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>{t('settings.providers.minOne')}</p>
            </div>
          ) : null}

          {devProvidersAvailable ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
              <input
                type="checkbox"
                checked={showDevProviders}
                disabled={disabled}
                onChange={(e) => setShowDevProviders(e.target.checked)}
              />
              <span>{t('settings.providers.showDevProviders')}</span>
            </label>
          ) : null}

          <ProviderScopeChecklist
            visibleProviderIds={visibleProviderIds}
            allowedProviderIds={allowedProviders}
            detectedProviderIds={providerCatalog.detectedProviders}
            onToggle={handleToggle}
            onSelectDetected={() =>
              onChange(
                filterAllowedToVisibleProviders(
                  providerCatalog.detectedProviders,
                  visibleProviderIds,
                ),
              )
            }
            onSelectAll={() => onChange([...visibleProviderIds])}
            onClear={() => onChange([])}
            disabled={disabled}
            density="compact"
          />
        </>
      )}
    </div>
  )
}
