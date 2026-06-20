import {
  type EngineConfig,
  isLiveProviderModelsSuccess,
  LIVE_PROVIDER_MODELS_TTL_MS,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_TOOLS_GUARD_MODES,
  type OllamaErrorCode,
  type OllamaToolsGuardMode,
  readOllamaBaseUrl,
  writeOllamaBaseUrl,
} from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { invalidateProviderModelsCache } from '../../hooks/provider-model-candidates-cache.js'
import { type I18nKey, type TranslateFn, useI18n } from '../../i18n'
import { engineConfigDiffersForOllamaHealth } from '../../lib/ollama-engine-health-preview.js'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'
import { OllamaModelsAdmin } from './ollama-models-admin.js'

export interface OllamaConnectionFieldsProps {
  formConfig: EngineConfig
  onFormConfigChange: (next: EngineConfig) => void
  toolsGuard: OllamaToolsGuardMode
  onToolsGuardChange: (mode: OllamaToolsGuardMode) => Promise<void>
  disabled?: boolean
}

type HealthStatus = 'healthy' | 'degraded' | 'unreachable'

function liveErrorMessage(
  t: TranslateFn,
  code: OllamaErrorCode | undefined,
  fallback: string,
): string {
  if (!code) return fallback
  const key = `settings.ollama.error.${code}` as I18nKey
  const translated = t(key)
  return translated === key ? fallback : translated
}

export function OllamaConnectionFields({
  formConfig,
  onFormConfigChange,
  toolsGuard,
  onToolsGuardChange,
  disabled,
}: OllamaConnectionFieldsProps) {
  const { t } = useI18n()
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [liveModelIds, setLiveModelIds] = useState<string[]>([])
  const [guardBusy, setGuardBusy] = useState(false)
  const savedEngineConfigRef = useRef<EngineConfig | null>(null)

  const baseUrl = readOllamaBaseUrl(formConfig) ?? ''

  const refreshHealth = useCallback(async () => {
    try {
      const saved = savedEngineConfigRef.current
      const usePreview = saved !== null && engineConfigDiffersForOllamaHealth(formConfig, saved)
      const health = await window.orbit.getOllamaHealth(
        usePreview ? { engineConfigPreview: formConfig } : undefined,
      )
      if (!usePreview) {
        const { config } = await window.orbit.getEngineConfig()
        savedEngineConfigRef.current = config
      }
      if (!health) {
        setHealthStatus(null)
        return
      }
      setHealthStatus(health.status)
    } catch {
      setHealthStatus('unreachable')
    }
  }, [formConfig])

  useEffect(() => {
    void refreshHealth()
    const id = window.setInterval(() => {
      void refreshHealth()
    }, LIVE_PROVIDER_MODELS_TTL_MS)
    return () => window.clearInterval(id)
  }, [refreshHealth])

  async function handleTestConnection() {
    setTesting(true)
    setTestStatus(null)
    setTestError(null)
    try {
      const result = await window.orbit.listProviderModels({
        provider: 'ollama',
        refresh: true,
        currentModel: formConfig.model,
        engineConfigPreview: formConfig,
      })
      const liveModels = result.models.filter((m) => m.source === 'live')
      setLiveModelIds(liveModels.map((m) => m.id))
      if (!isLiveProviderModelsSuccess(result)) {
        setTestError(liveErrorMessage(t, result.liveErrorCode, result.liveError ?? 'Unknown error'))
        setHealthStatus('unreachable')
        return
      }
      setHealthStatus('healthy')
      setTestStatus(
        liveModels.length > 0
          ? t('settings.ollama.testConnected', { count: liveModels.length })
          : t('settings.ollama.testConnectedEmpty'),
      )
      invalidateProviderModelsCache('ollama')
      void refreshHealth()
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err))
      setHealthStatus('unreachable')
    } finally {
      setTesting(false)
    }
  }

  async function handleToolsGuardChange(mode: OllamaToolsGuardMode) {
    setGuardBusy(true)
    try {
      await onToolsGuardChange(mode)
    } finally {
      setGuardBusy(false)
    }
  }

  const healthLabel =
    healthStatus === 'healthy'
      ? t('settings.ollama.healthHealthy')
      : healthStatus === 'degraded'
        ? t('settings.ollama.healthDegraded')
        : healthStatus === 'unreachable'
          ? t('settings.ollama.healthUnreachable')
          : null

  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {t('settings.ollama.sectionTitle')}
      </p>
      <div className="flex flex-col gap-2">
        <Field label={t('settings.ollama.baseUrlLabel')} htmlFor="ollama-base-url">
          <Input
            id="ollama-base-url"
            type="url"
            placeholder={OLLAMA_DEFAULT_BASE_URL}
            value={baseUrl}
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value.trim()
              onFormConfigChange(
                writeOllamaBaseUrl(formConfig, value.length > 0 ? value : undefined),
              )
            }}
          />
        </Field>
        <Field label={t('settings.ollama.toolsGuardLabel')} htmlFor="ollama-tools-guard">
          <select
            id="ollama-tools-guard"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
            value={toolsGuard}
            disabled={disabled || guardBusy}
            onChange={(e) => {
              void handleToolsGuardChange(e.target.value as OllamaToolsGuardMode)
            }}
          >
            {OLLAMA_TOOLS_GUARD_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`settings.ollama.toolsGuard.${mode}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || testing}
            onClick={() => void handleTestConnection()}
          >
            {testing ? t('settings.ollama.testing') : t('settings.ollama.testConnection')}
          </Button>
          {healthLabel ? (
            <span
              className={`text-xs ${
                healthStatus === 'healthy'
                  ? 'text-[var(--color-status-done)]'
                  : healthStatus === 'degraded'
                    ? 'text-[var(--color-alert)]'
                    : 'text-[var(--color-status-failed)]'
              }`}
            >
              {healthLabel}
            </span>
          ) : null}
        </div>
        {testError ? (
          <p className="text-xs text-[var(--color-status-failed)]">{testError}</p>
        ) : null}
        {testStatus ? (
          <p className="text-xs text-[var(--color-status-done)]">{testStatus}</p>
        ) : null}
        <p className="text-[11px] text-[var(--color-muted)]">{t('settings.ollama.toolsHint')}</p>
        <OllamaModelsAdmin
          formConfig={formConfig}
          liveModelIds={liveModelIds}
          disabled={disabled}
        />
      </div>
    </section>
  )
}
