import type { AgentState, SkinDefinition } from '@planetz/shared'
import { useI18n, useResolvedPanelTitle } from '../i18n'
import { AgentCard } from './agent-card'
import { PanelShell } from './panel-shell'

interface AgentBoardProps {
  agents: AgentState[]
  skin: SkinDefinition
  onClose?: () => void
}

export function AgentBoard({ agents, skin, onClose }: AgentBoardProps) {
  const { t } = useI18n()
  const title = useResolvedPanelTitle('agents')
  const working = agents.filter((a) => a.status === 'working' || a.status === 'reviewing').length
  return (
    <PanelShell
      title={title}
      subtitle={`${working} active · ${agents.length} total`}
      className="h-full"
      onClose={onClose}
    >
      {agents.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--color-muted)]">
          {t('panels.noAgents')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {agents.map((agent) => (
            <li key={agent.id}>
              <AgentCard agent={agent} skin={skin} />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
