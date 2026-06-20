import {
  type AgentExecutionSource,
  type AgentOverrides,
  type AgentState,
  type EngineConfig,
  findDuplicatePersonaKeys,
  type PersonaProviderEntry,
  type PersonaProviderRow,
  personaProvidersToRows,
  planetzAgentOverridesRelPath,
  planetzEngineConfigRelPath,
  planetzWorkflowsDirRelPath,
  resolveAgentRoleExecution,
  rowsToPersonaProviders,
} from '@planetz/shared'
import { ExternalLink, Lock, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { invalidateProviderEffortsCache } from '../../hooks/provider-effort-candidates-cache.js'
import { invalidateProviderModelsCache } from '../../hooks/provider-model-candidates-cache.js'
import { useSkin } from '../../skins/context'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Field, Input } from '../ui/input'

interface AgentConfigPanelProps {
  agents: AgentState[]
  onOpenWorkflows?: () => void
}

const ROLE_DESCRIPTION: Record<AgentState['role'], string> = {
  planner: 'Breaks the request into tasks and writes the work plan.',
  coder: 'Implements the planned changes against the working tree.',
  reviewer: 'Reads diffs and flags issues before the work is accepted.',
  tester: 'Runs tests and verifies the change behaves as intended.',
  custom: 'Custom role defined by a workflow or external runtime.',
}

const RUNTIME_LABEL: Record<AgentState['runtime'], string> = {
  takt: 'Built-in (Takt)',
  external: 'External runtime',
}

const SOURCE_LABEL: Record<AgentExecutionSource, string> = {
  'project-override': 'project override',
  'persona-override': 'persona override',
  'workspace-default': 'workspace default',
}

function rowForRole(rows: PersonaProviderRow[], role: string): PersonaProviderRow {
  const existing = rows.find((r) => r.persona.trim() === role)
  if (existing) return existing
  return {
    persona: role,
    mode: 'structured',
    shorthand: '',
    provider: '',
    model: '',
    type: '',
    effort: '',
  }
}

function formatProviderModel(provider?: string, model?: string): string {
  if (provider && model) return `${provider} / ${model}`
  if (provider) return provider
  if (model) return model
  return '—'
}

export function AgentConfigPanel({ agents, onOpenWorkflows }: AgentConfigPanelProps) {
  const skin = useSkin()
  const [engineConfig, setEngineConfig] = useState<EngineConfig | null>(null)
  const [overrides, setOverrides] = useState<AgentOverrides | null>(null)
  const [overrideRows, setOverrideRows] = useState<PersonaProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [yamlMessage, setYamlMessage] = useState<string | null>(null)

  const applyLoaded = useCallback((engine: EngineConfig, loadedOverrides: AgentOverrides) => {
    setEngineConfig(engine)
    setOverrides(loadedOverrides)
    setOverrideRows(personaProvidersToRows(loadedOverrides.persona_providers))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [engineResult, overridesResult] = await Promise.all([
        window.orbit.getEngineConfig(),
        window.orbit.getAgentOverrides(),
      ])
      applyLoaded(engineResult.config, overridesResult.overrides)
    } catch (err) {
      setEngineConfig(null)
      setOverrides(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [applyLoaded])

  useEffect(() => {
    void load()
  }, [load])

  async function handleOpenYaml(target: 'engine-config' | 'agent-overrides') {
    setYamlMessage(null)
    try {
      const result = await window.orbit.openYaml({ target })
      if (result.status === 'opened') return
      if (result.status === 'not_found') {
        if (target === 'agent-overrides') {
          setYamlMessage(
            `${planetzAgentOverridesRelPath()} does not exist yet. Save overrides once, then open again.`,
          )
          return
        }
        if (target === 'engine-config') {
          setYamlMessage(
            `${planetzEngineConfigRelPath()} is missing. Import or create engine config from the Engine tab first.`,
          )
          return
        }
      }
      setYamlMessage(result.message ?? `Could not open YAML (${result.status})`)
    } catch (err) {
      setYamlMessage(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSaveOverrides() {
    if (!overrides) return
    const duplicatePersonas = findDuplicatePersonaKeys(overrideRows)
    if (duplicatePersonas.length > 0) {
      setError(`Duplicate persona names: ${duplicatePersonas.join(', ')}`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const persona_providers = rowsToPersonaProviders(overrideRows) as
        | Record<string, PersonaProviderEntry>
        | undefined
      const result = await window.orbit.updateAgentOverrides({ persona_providers })
      applyLoaded(result.engineConfig, result.overrides)
      invalidateProviderModelsCache()
      invalidateProviderEffortsCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function updateRoleRow(role: string, patch: Partial<PersonaProviderRow>) {
    setOverrideRows((rows) => {
      const next = [...rows]
      const index = next.findIndex((r) => r.persona.trim() === role)
      const base = index >= 0 ? next[index]! : rowForRole(rows, role)
      const updated = { ...base, ...patch, persona: role, mode: 'structured' as const }
      if (index >= 0) next[index] = updated
      else next.push(updated)
      return next
    })
  }

  if (loading && !engineConfig) {
    return <p className="text-xs text-[var(--color-muted)]">Loading agent configuration…</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-xs text-[var(--color-muted)]">
        Default roles that run your workflows. Per-role provider/model overrides are stored in{' '}
        <span className="font-mono">{planetzAgentOverridesRelPath()}</span> and take precedence over{' '}
        <span className="font-mono">{planetzEngineConfigRelPath()}</span> at runtime.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleOpenYaml('agent-overrides')}
          disabled={busy}
        >
          <ExternalLink size={14} /> Open overrides YAML
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleOpenYaml('engine-config')}
          disabled={busy}
        >
          <ExternalLink size={14} /> Open engine YAML
        </Button>
      </div>

      {yamlMessage ? (
        <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
          {yamlMessage}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
          Roles
        </h3>
        <ul className="flex flex-col gap-1.5">
          {agents.map((agent) => {
            const roleLabel = skin.roleLabel?.(agent.role) ?? agent.role
            const resolved =
              engineConfig && overrides
                ? resolveAgentRoleExecution(agent.role, engineConfig, overrides)
                : null
            const row = rowForRole(overrideRows, agent.role)
            return (
              <li
                key={agent.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {agent.displayName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                      {ROLE_DESCRIPTION[agent.role]}
                    </p>
                  </div>
                  {agent.role === 'custom' ? (
                    <Badge tone="neutral" title="Edit in workflow YAML">
                      <Lock size={10} /> workflow
                    </Badge>
                  ) : (
                    <Badge tone="neutral" title="Runtime routing source">
                      {resolved ? SOURCE_LABEL[resolved.source] : '—'}
                    </Badge>
                  )}
                </div>

                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                  <dt className="text-[var(--color-muted)]">Role</dt>
                  <dd className="text-[var(--color-text)]">{roleLabel}</dd>
                  <dt className="text-[var(--color-muted)]">Runtime</dt>
                  <dd className="text-[var(--color-text)]">{RUNTIME_LABEL[agent.runtime]}</dd>
                  <dt className="text-[var(--color-muted)]">Effective</dt>
                  <dd className="font-mono text-[var(--color-text)]">
                    {resolved ? formatProviderModel(resolved.provider, resolved.model) : '—'}
                  </dd>
                  <dt className="text-[var(--color-muted)]">ID</dt>
                  <dd className="truncate font-mono text-[var(--color-text)]">{agent.id}</dd>
                </dl>

                {agent.role !== 'custom' ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Field label="Override provider">
                      <Input
                        value={row.provider}
                        onChange={(e) => updateRoleRow(agent.role, { provider: e.target.value })}
                        placeholder={resolved?.provider ?? 'provider'}
                        disabled={busy}
                      />
                    </Field>
                    <Field label="Override model">
                      <Input
                        value={row.model}
                        onChange={(e) => updateRoleRow(agent.role, { model: e.target.value })}
                        placeholder={resolved?.model ?? 'model'}
                        disabled={busy}
                      />
                    </Field>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        <div className="mt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSaveOverrides()}
            disabled={busy}
          >
            <Save size={14} /> Save role overrides
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]">
          Customize or add a role
        </h3>
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          Built-in roles accept project overrides above. To change prompts or add workflow-only
          personas, declare a <span className="font-mono">persona</span> in workflow YAML under{' '}
          <span className="font-mono">{planetzWorkflowsDirRelPath()}/</span>.
        </p>
        {onOpenWorkflows ? (
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={onOpenWorkflows}>
              Open Workflows
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
