import type { AgentState, SkinDefinition, TaskViewModel } from '@planetz/shared'

/**
 * Galaxy · Supernova — solar flare gold across a black-hole void.
 * Palette: #000000 · #051427 · #5a3a1c · #a44322 · #f8bc04
 */
export const supernovaSkin: SkinDefinition = {
  id: 'supernova',
  displayName: 'Galaxy · Supernova',
  tokens: {
    '--color-background': '#000000',
    '--color-surface': '#051427',
    '--color-surface-elevated': '#0c2240',
    '--color-panel': '#051427',
    '--color-panel-strong': '#0c2240',
    '--color-overlay': 'rgb(0 0 0 / 0.85)',

    '--color-text': '#f4e8c8',
    '--color-text-strong': '#fff8dc',
    '--color-muted': '#a89880',
    '--color-muted-strong': '#f8bc04',

    '--color-border': '#1a2f4a',
    '--color-border-strong': '#5a3a1c',
    '--color-ring': '#f8bc04',

    '--color-accent': '#f8bc04',
    '--color-accent-soft': 'rgb(248 188 4 / 0.18)',
    '--color-accent-foreground': '#000000',

    '--color-status-pending': '#a89880',
    '--color-status-pending-soft': 'rgb(168 152 128 / 0.18)',
    '--color-status-running': '#f8bc04',
    '--color-status-running-soft': 'rgb(248 188 4 / 0.20)',
    '--color-status-stopped': '#d4a373',
    '--color-status-stopped-soft': 'rgb(212 163 115 / 0.24)',
    '--color-status-completed': '#4fa55a',
    '--color-status-completed-soft': 'rgb(79 165 90 / 0.22)',
    '--color-status-failed': '#5a3a1c',
    '--color-status-failed-soft': 'rgb(90 58 28 / 0.32)',
    '--color-status-exceeded': '#a44322',
    '--color-status-exceeded-soft': 'rgb(164 67 34 / 0.24)',

    '--skin-accent': '#f8bc04',
    '--skin-surface': '#051427',
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
