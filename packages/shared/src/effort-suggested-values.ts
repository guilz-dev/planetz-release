/** Suggested effort values (aligned with bundled takt `workflow-provider-options`). */
export const CODEX_REASONING_EFFORT_VALUES = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const

export const CLAUDE_EFFORT_VALUES = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export const COPILOT_EFFORT_VALUES = ['low', 'medium', 'high', 'xhigh'] as const

export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORT_VALUES)[number]
export type ClaudeEffort = (typeof CLAUDE_EFFORT_VALUES)[number]
export type CopilotEffort = (typeof COPILOT_EFFORT_VALUES)[number]

export function effortHintsForOrbitProvider(provider: string | undefined): readonly string[] {
  const id = provider?.trim()
  if (!id) return []
  if (id === 'codex') return CODEX_REASONING_EFFORT_VALUES
  if (id === 'claude' || id === 'claude-sdk' || id === 'claude-terminal') {
    return CLAUDE_EFFORT_VALUES
  }
  if (id === 'copilot') return COPILOT_EFFORT_VALUES
  return []
}
