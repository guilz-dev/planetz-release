import type { AgentState, SkinDefinition, TaskViewModel } from '@planetz/shared'

/**
 * default = Guilz dashboard dark theme (Catppuccin Macchiato).
 * Tokens defined in index.css; this skin keeps the base values and only
 * provides task/agent visual mapping.
 */
export const defaultSkin: SkinDefinition = {
  id: 'default',
  displayName: 'Macchiato',
  tokens: {
    '--skin-accent': 'var(--color-accent)',
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
