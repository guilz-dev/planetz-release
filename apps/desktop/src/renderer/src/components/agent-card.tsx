import type { AgentState, SkinDefinition } from '@planetz/shared'
import { GitBranch, Plug } from 'lucide-react'
import { Badge } from './ui/badge'
import { StatusDot } from './ui/status-dot'

const ROLE_GLYPH: Record<AgentState['role'], string> = {
  planner: 'PL',
  coder: 'CD',
  reviewer: 'RV',
  tester: 'TS',
  custom: 'XX',
}

interface AgentCardProps {
  agent: AgentState
  skin: SkinDefinition
}

export function AgentCard({ agent, skin }: AgentCardProps) {
  const visual = skin.mapAgentVisual(agent)
  const pulsing = agent.status === 'working' || agent.status === 'reviewing'
  const roleLabel = skin.roleLabel?.(agent.role) ?? agent.role
  const statusLabel = skin.agentStatusLabel?.(agent.status) ?? agent.status

  return (
    <article
      className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 px-3 py-2.5 transition-colors hover:border-[var(--color-border-strong)]"
      style={{ boxShadow: `inset 3px 0 0 0 ${visual.accentToken}` }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-panel-strong)] text-[10px] font-semibold tracking-wider text-[var(--color-muted-strong)]">
          {ROLE_GLYPH[agent.role]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-medium text-[var(--color-text)]">
              {visual.label}
            </h3>
            <StatusDot tone={agent.status} pulse={pulsing} />
            {agent.runtime === 'external' ? (
              <Badge tone="accent" className="ml-auto">
                <Plug size={9} /> external
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {roleLabel} · {statusLabel}
          </p>
          {agent.currentTaskId ? (
            <p className="mt-1.5 truncate font-mono text-[11px] text-[var(--color-accent)]">
              {agent.currentTaskId}
            </p>
          ) : null}
          {agent.branch ? (
            <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-[11px] text-[var(--color-muted-strong)]">
              <GitBranch size={10} />
              {agent.branch}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
