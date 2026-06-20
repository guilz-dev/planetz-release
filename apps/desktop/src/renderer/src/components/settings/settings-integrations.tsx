import type { ChatMcpServerSummary, IntegrationAdapterId, IntegrationsState } from '@planetz/shared'
import { Cable, KeyRound, ShieldAlert, Webhook } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'

type PushFeedback = {
  kind: 'pending' | 'success' | 'error'
  message: string
}

interface SettingsIntegrationsProps {
  integrations: IntegrationsState
  hookBearerSecret: string | null
  onDismissBearerSecret: () => void
  onToggleHookServer: (input: {
    enabled: boolean
    port?: number
  }) => Promise<{ bearerSecret?: string }>
  onToggleAdapter: (id: IntegrationAdapterId, enabled: boolean) => Promise<void>
  onPushAdapter: (id: IntegrationAdapterId) => Promise<void>
}

export function SettingsIntegrations({
  integrations,
  hookBearerSecret,
  onDismissBearerSecret,
  onToggleHookServer,
  onToggleAdapter,
  onPushAdapter,
}: SettingsIntegrationsProps) {
  const { t } = useI18n()
  const [port, setPort] = useState(integrations.hookServer.port.toString())
  const [pushFeedbackByAdapter, setPushFeedbackByAdapter] = useState<
    Partial<Record<IntegrationAdapterId, PushFeedback>>
  >({})
  const [mcpServers, setMcpServers] = useState<ChatMcpServerSummary[]>([])
  const [mcpSecureStoreAvailable, setMcpSecureStoreAvailable] = useState(false)
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const [savingSecretName, setSavingSecretName] = useState<string | null>(null)
  const [secretFeedback, setSecretFeedback] = useState<string | null>(null)

  const toErrorMessage = useCallback(
    (error: unknown): string => {
      if (error instanceof Error && error.message.trim()) return error.message
      return t('settings.integrations.testPushFailed')
    },
    [t],
  )

  const loadMcpOverview = useCallback(async (): Promise<void> => {
    if (typeof window.orbit?.listChatMcpServersOverview !== 'function') return
    setMcpLoading(true)
    try {
      const result = await window.orbit.listChatMcpServersOverview()
      setMcpServers(result.servers)
      setMcpSecureStoreAvailable(result.secureStoreAvailable)
      setMcpError(null)
    } catch (error) {
      setMcpError(toErrorMessage(error))
    } finally {
      setMcpLoading(false)
    }
  }, [toErrorMessage])

  useEffect(() => {
    void loadMcpOverview()
  }, [loadMcpOverview])

  function updateSecretDraft(secretName: string, value: string): void {
    setSecretDrafts((current) => ({ ...current, [secretName]: value }))
  }

  async function handleSaveSecret(secretName: string): Promise<void> {
    if (typeof window.orbit?.setChatMcpSecret !== 'function') return
    const value = secretDrafts[secretName]?.trim()
    if (!value) {
      setSecretFeedback(t('settings.integrations.mcp.secretValueRequired', { secretName }))
      return
    }
    setSavingSecretName(secretName)
    setSecretFeedback(null)
    try {
      const result = await window.orbit.setChatMcpSecret({ secretName, secretValue: value })
      setSecretFeedback(
        result.storage === 'secure'
          ? t('settings.integrations.mcp.secretSavedSecure', { secretName })
          : t('settings.integrations.mcp.secretSavedFallback', { secretName }),
      )
      setSecretDrafts((current) => ({ ...current, [secretName]: '' }))
      await loadMcpOverview()
    } catch (error) {
      setSecretFeedback(toErrorMessage(error))
    } finally {
      setSavingSecretName(null)
    }
  }

  async function handleTestPush(id: IntegrationAdapterId): Promise<void> {
    setPushFeedbackByAdapter((current) => ({
      ...current,
      [id]: { kind: 'pending', message: 'Sending test push...' },
    }))
    try {
      await onPushAdapter(id)
      setPushFeedbackByAdapter((current) => ({
        ...current,
        [id]: {
          kind: 'success',
          message: t('settings.integrations.testPushSent'),
        },
      }))
    } catch (error) {
      setPushFeedbackByAdapter((current) => ({
        ...current,
        [id]: { kind: 'error', message: toErrorMessage(error) },
      }))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            <Webhook size={14} className="text-[var(--color-accent)]" /> HookServer
          </h3>
          <Badge tone={integrations.hookServer.enabled ? 'completed' : 'neutral'}>
            {integrations.hookServer.enabled ? 'running' : 'stopped'}
          </Badge>
        </header>

        <div className="flex items-end gap-3">
          <Field label="Port">
            <Input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-24"
            />
          </Field>
          <Button
            variant={integrations.hookServer.enabled ? 'secondary' : 'primary'}
            onClick={() =>
              void onToggleHookServer({
                enabled: !integrations.hookServer.enabled,
                port: Number(port) || undefined,
              })
            }
          >
            {integrations.hookServer.enabled ? 'Stop' : 'Start'}
          </Button>
          <p className="ml-3 flex-1 pb-1 text-[11px] leading-snug text-[var(--color-muted)]">
            <ShieldAlert
              size={12}
              className="mr-1 inline -translate-y-px text-[var(--color-status-exceeded)]"
            />
            HookServer listens on <span className="font-mono">{integrations.hookServer.bind}</span>{' '}
            only. The Bearer secret stays in memory only and is never written to config. Use{' '}
            <code className="font-mono">Authorization: Bearer &lt;secret&gt;</code> for{' '}
            <code className="font-mono">/health</code>,{' '}
            <code className="font-mono">/agents/push</code>, and{' '}
            <code className="font-mono">/agents/log</code>.{' '}
            <code className="font-mono">/tasks/external</code> is not supported yet and returns 501.
          </p>
        </div>

        {hookBearerSecret ? (
          <div className="mt-3 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-panel-strong)]/60 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-[var(--color-text)]">
                Bearer secret (copy now — shown once per start)
              </p>
              <Button size="sm" variant="ghost" onClick={onDismissBearerSecret}>
                Dismiss
              </Button>
            </div>
            <code className="mt-1 block break-all font-mono text-[10px] text-[var(--color-accent)]">
              {hookBearerSecret}
            </code>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
        <header className="mb-3 flex items-center gap-1.5">
          <Cable size={14} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
            External adapters
          </h3>
        </header>
        <ul className="flex flex-col gap-2">
          {integrations.adapters.map((adapter) => {
            const pushFeedback = pushFeedbackByAdapter[adapter.id]
            const pushPending = pushFeedback?.kind === 'pending'
            return (
              <li
                key={adapter.id}
                className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-3 py-2.5"
              >
                <KeyRound size={14} className="mt-0.5 text-[var(--color-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {adapter.displayName}
                    </p>
                    <Badge tone={adapter.enabled ? 'completed' : 'neutral'}>
                      {adapter.enabled ? 'enabled' : 'off'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--color-muted-strong)]">
                    {adapter.description}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Button
                    size="sm"
                    variant={adapter.enabled ? 'secondary' : 'subtle'}
                    onClick={() => void onToggleAdapter(adapter.id, !adapter.enabled)}
                  >
                    {adapter.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleTestPush(adapter.id)}
                    disabled={!adapter.enabled || !integrations.hookServer.enabled || pushPending}
                  >
                    {pushPending ? 'Pushing...' : 'Test push'}
                  </Button>
                  {pushFeedback ? (
                    <p
                      className={
                        pushFeedback.kind === 'error'
                          ? 'max-w-64 text-right text-[10px] text-[var(--color-status-failed)]'
                          : 'max-w-64 text-right text-[10px] text-[var(--color-muted-strong)]'
                      }
                    >
                      {pushFeedback.message}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
            {t('settings.integrations.mcp.title')}
          </h3>
          <Badge tone={mcpSecureStoreAvailable ? 'completed' : 'neutral'}>
            {mcpSecureStoreAvailable
              ? t('settings.integrations.mcp.storeSecure')
              : t('settings.integrations.mcp.storeFallback')}
          </Badge>
        </header>
        {mcpLoading ? (
          <p className="text-xs text-[var(--color-muted)]">
            {t('settings.integrations.mcp.loading')}
          </p>
        ) : mcpError ? (
          <p className="text-xs text-[var(--color-status-failed)]">{mcpError}</p>
        ) : mcpServers.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            {t('settings.integrations.mcp.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mcpServers.map((server) => (
              <li
                key={server.serverId}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs text-[var(--color-text)]">{server.serverId}</p>
                  <Badge tone={server.enabled ? 'completed' : 'neutral'}>
                    {server.enabled
                      ? t('settings.integrations.mcp.statusEnabled')
                      : t('settings.integrations.mcp.statusDisabled')}
                  </Badge>
                  <Badge tone={server.consentGranted ? 'completed' : 'pending'}>
                    {server.consentGranted
                      ? t('settings.integrations.mcp.statusConsented')
                      : t('settings.integrations.mcp.statusConsentRequired')}
                  </Badge>
                  <Badge tone="neutral">{server.transport}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-muted-strong)]">
                  {t('settings.integrations.mcp.allowedTools')}:{' '}
                  {server.allowedTools.length > 0
                    ? server.allowedTools.join(', ')
                    : t('settings.integrations.mcp.allowedToolsUnrestricted')}
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-muted-strong)]">
                  {t('settings.integrations.mcp.secretRefs')}:{' '}
                  {server.secretRefs.length > 0
                    ? server.secretRefs.join(', ')
                    : t('settings.integrations.mcp.secretRefsNone')}
                </p>
                {server.unresolvedSecretRefs.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {server.unresolvedSecretRefs.map((secretName) => (
                      <div
                        key={`${server.serverId}:${secretName}`}
                        className="flex items-center gap-2"
                      >
                        <span className="w-44 shrink-0 font-mono text-[11px] text-[var(--color-muted)]">
                          {secretName}
                        </span>
                        <Input
                          type="password"
                          className="h-8"
                          value={secretDrafts[secretName] ?? ''}
                          onChange={(event) => updateSecretDraft(secretName, event.target.value)}
                          placeholder={t('settings.integrations.mcp.secretPlaceholder')}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={savingSecretName === secretName}
                          onClick={() => void handleSaveSecret(secretName)}
                        >
                          {savingSecretName === secretName ? t('common.saving') : t('common.save')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {secretFeedback ? (
          <p className="mt-2 text-[11px] text-[var(--color-muted-strong)]">{secretFeedback}</p>
        ) : null}
      </section>
    </div>
  )
}
