import type { AgentState, SkinDefinition, TaskViewModel } from '@planetz/shared'

/**
 * Galaxy · Nebula — cool aurora-blue cloud drifting across deep space.
 * Palette: #062c43 · #054569 · #5591a9 · #9ccddc · #ced7e0
 */
export const nebulaSkin: SkinDefinition = {
  id: 'nebula',
  displayName: 'Galaxy · Nebula',
  tokens: {
    '--color-background': '#062c43',
    '--color-surface': '#062c43',
    '--color-surface-elevated': '#054569',
    '--color-panel': '#054569',
    '--color-panel-strong': '#0a5d8a',
    '--color-overlay': 'rgb(6 44 67 / 0.82)',

    '--color-text': '#ced7e0',
    '--color-text-strong': '#f3f7fa',
    '--color-muted': '#7fa3b8',
    '--color-muted-strong': '#9ccddc',

    '--color-border': '#0a3d5c',
    '--color-border-strong': '#1a5a82',
    '--color-ring': '#9ccddc',

    '--color-accent': '#5591a9',
    '--color-accent-soft': 'rgb(85 145 169 / 0.22)',
    '--color-accent-foreground': '#062c43',

    '--color-status-pending': '#7fa3b8',
    '--color-status-pending-soft': 'rgb(127 163 184 / 0.18)',
    '--color-status-running': '#5fb7d4',
    '--color-status-running-soft': 'rgb(95 183 212 / 0.22)',
    '--color-status-stopped': '#b5b6a0',
    '--color-status-stopped-soft': 'rgb(181 182 160 / 0.22)',
    '--color-status-completed': '#7ec8a9',
    '--color-status-completed-soft': 'rgb(126 200 169 / 0.20)',
    '--color-status-failed': '#e08394',
    '--color-status-failed-soft': 'rgb(224 131 148 / 0.22)',
    '--color-status-exceeded': '#f0b878',
    '--color-status-exceeded-soft': 'rgb(240 184 120 / 0.20)',

    '--skin-accent': '#5591a9',
    '--skin-surface': '#054569',
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
