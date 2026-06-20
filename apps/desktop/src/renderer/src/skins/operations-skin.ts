import type { AgentState, SkinDefinition, TaskViewModel } from '@planetz/shared'

/**
 * Operations skin — Catppuccin Macchiato surface with the running accent
 * shifted to teal so multiple Planetz windows can be told apart at a
 * glance. Base/border/text tokens stay on Macchiato.
 */
export const operationsSkin: SkinDefinition = {
  id: 'operations',
  displayName: 'Macchiato · Teal',
  tokens: {
    '--color-accent': 'var(--color-cat-teal)',
    '--color-accent-soft': 'rgb(139 213 202 / 0.18)',
    '--color-accent-foreground': 'var(--color-cat-crust)',
    '--color-status-running': 'var(--color-cat-sky)',
    '--color-status-running-soft': 'rgb(145 215 227 / 0.18)',
    '--color-ring': 'var(--color-cat-teal)',
    '--skin-accent': 'var(--color-cat-teal)',
    '--skin-surface': 'var(--color-panel)',
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
