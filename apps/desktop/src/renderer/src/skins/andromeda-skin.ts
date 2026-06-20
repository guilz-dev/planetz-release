import type { AgentState, SkinDefinition, TaskViewModel } from '@planetz/shared'

/**
 * Galaxy · Andromeda — crimson nebula over a deep cosmic blue void.
 * Palette: #0b1f3a · #76101e · #133769 · #c9374c · #c2dde4
 */
export const andromedaSkin: SkinDefinition = {
  id: 'andromeda',
  displayName: 'Galaxy · Andromeda',
  tokens: {
    '--color-background': '#0b1f3a',
    '--color-surface': '#0b1f3a',
    '--color-surface-elevated': '#133769',
    '--color-panel': '#133769',
    '--color-panel-strong': '#1c4a8a',
    '--color-overlay': 'rgb(11 31 58 / 0.82)',

    '--color-text': '#c2dde4',
    '--color-text-strong': '#f5fbfd',
    '--color-muted': '#7e9bb5',
    '--color-muted-strong': '#c2dde4',

    '--color-border': '#1c3a6b',
    '--color-border-strong': '#2a5599',
    '--color-ring': '#c9374c',

    '--color-accent': '#c9374c',
    '--color-accent-soft': 'rgb(201 55 76 / 0.18)',
    '--color-accent-foreground': '#f5fbfd',

    '--color-status-pending': '#7e9bb5',
    '--color-status-pending-soft': 'rgb(126 155 181 / 0.18)',
    '--color-status-running': '#6bb6d4',
    '--color-status-running-soft': 'rgb(107 182 212 / 0.22)',
    '--color-status-stopped': '#d2b48c',
    '--color-status-stopped-soft': 'rgb(210 180 140 / 0.22)',
    '--color-status-completed': '#7cc9a3',
    '--color-status-completed-soft': 'rgb(124 201 163 / 0.18)',
    '--color-status-failed': '#c9374c',
    '--color-status-failed-soft': 'rgb(201 55 76 / 0.22)',
    '--color-status-exceeded': '#76101e',
    '--color-status-exceeded-soft': 'rgb(118 16 30 / 0.30)',

    '--skin-accent': '#c9374c',
    '--skin-surface': '#133769',
  },
  mapTaskVisual(task: TaskViewModel) {
    return {
      label: task.title,
      accentToken: `var(--color-status-${task.status})`,
    }
  },
  mapAgentVisual(agent: AgentState) {
    return {
      label: agent.displayName,
      accentToken:
        agent.status === 'working' || agent.status === 'reviewing'
          ? 'var(--color-status-running)'
          : agent.status === 'error'
            ? 'var(--color-status-failed)'
            : 'var(--color-muted)',
    }
  },
}
