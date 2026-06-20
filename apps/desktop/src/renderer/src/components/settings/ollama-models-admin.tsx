import {
  type EngineConfig,
  isOllamaLoopbackOrigin,
  normalizeOllamaOriginForFetch,
  readOllamaBaseUrl,
} from '@planetz/shared'
import { useState } from 'react'
import { invalidateProviderModelsCache } from '../../hooks/provider-model-candidates-cache.js'
import { useI18n } from '../../i18n'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'

export interface OllamaModelsAdminProps {
  formConfig: EngineConfig
  liveModelIds: string[]
  disabled?: boolean
}

export function OllamaModelsAdmin({ formConfig, liveModelIds, disabled }: OllamaModelsAdminProps) {
  const { t } = useI18n()
  const [pullName, setPullName] = useState('')
  const [pullBusy, setPullBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = readOllamaBaseUrl(formConfig)
  const origin = normalizeOllamaOriginForFetch(baseUrl)
  const deleteAllowed = isOllamaLoopbackOrigin(origin)

  async function handlePull() {
    const model = pullName.trim()
    if (!model) return
    setPullBusy(true)
    setStatus(null)
    setError(null)
    try {
      await window.orbit.pullOllamaModel({ model, engineConfigPreview: formConfig })
      setStatus(t('settings.ollama.pullSuccess', { model }))
      setPullName('')
      invalidateProviderModelsCache('ollama')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPullBusy(false)
    }
  }

  async function handleDelete(model: string) {
    if (!deleteAllowed) return
    if (!window.confirm(t('settings.ollama.deleteConfirm', { model }))) return
    setDeleteBusy(model)
    setStatus(null)
    setError(null)
    try {
      await window.orbit.deleteOllamaModel({ model, engineConfigPreview: formConfig })
      setStatus(t('settings.ollama.deleteSuccess', { model }))
      invalidateProviderModelsCache('ollama')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleteBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {t('settings.ollama.modelsTitle')}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Field label={t('settings.ollama.pullLabel')} htmlFor="ollama-pull-model">
            <Input
              id="ollama-pull-model"
              value={pullName}
              disabled={disabled || pullBusy}
              placeholder={t('settings.ollama.pullPlaceholder')}
              onChange={(e) => setPullName(e.target.value)}
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || pullBusy || pullName.trim().length === 0}
          onClick={() => void handlePull()}
        >
          {pullBusy ? t('settings.ollama.pulling') : t('settings.ollama.pull')}
        </Button>
      </div>
      {liveModelIds.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {liveModelIds.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] px-2 py-1 text-xs"
            >
              <span className="truncate font-mono">{id}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || !deleteAllowed || deleteBusy === id}
                onClick={() => void handleDelete(id)}
              >
                {deleteBusy === id ? t('settings.ollama.deleting') : t('settings.ollama.delete')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[var(--color-muted)]">{t('settings.ollama.modelsEmpty')}</p>
      )}
      {!deleteAllowed ? (
        <p className="text-[11px] text-[var(--color-muted)]">
          {t('settings.ollama.deleteRemoteHint')}
        </p>
      ) : null}
      {error ? <p className="text-xs text-[var(--color-status-failed)]">{error}</p> : null}
      {status ? <p className="text-xs text-[var(--color-status-done)]">{status}</p> : null}
    </div>
  )
}
