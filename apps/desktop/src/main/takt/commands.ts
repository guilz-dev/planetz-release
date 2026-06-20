/**
 * Inserts `--` so following tokens are treated as positional (user-controlled) argv.
 * @see https://github.com/guilz-dev/planetz/issues/7
 */
export function appendArgvUserPositionals(prefix: string[], ...positionals: string[]): string[] {
  if (positionals.length === 0) return prefix
  return [...prefix, '--', ...positionals]
}

export function taktListJsonCommand(): string[] {
  return ['list', '--non-interactive', '--format', 'json']
}

export function taktAddCommand(prompt: string, workflow?: string): string[] {
  const trimmed = workflow?.trim()
  const prefix = trimmed ? ['add', '--workflow', trimmed] : ['add']
  return appendArgvUserPositionals(prefix, prompt)
}

/** Optional CLI overrides for bundled takt global options (see takt program.js). */
export interface TaktAgentCliOverrides {
  provider?: string
  model?: string
}

/** Prepends `--provider` / `--model` before the rest of the argv when set. */
export function appendTaktAgentOverrides(
  args: string[],
  overrides?: TaktAgentCliOverrides,
): string[] {
  if (!overrides?.provider && !overrides?.model) return args
  const prefix: string[] = []
  if (overrides.provider) prefix.push('--provider', overrides.provider)
  if (overrides.model) prefix.push('--model', overrides.model)
  return [...prefix, ...args]
}

export function taktRunTaskCommand(
  prompt: string,
  workflow: string,
  overrides?: TaktAgentCliOverrides,
): string[] {
  return appendTaktAgentOverrides(['--task', prompt, '--workflow', workflow], overrides)
}

export function taktRunAllCommand(overrides?: TaktAgentCliOverrides): string[] {
  return appendTaktAgentOverrides(['run'], overrides)
}

export function taktWatchCommand(overrides?: TaktAgentCliOverrides): string[] {
  return appendTaktAgentOverrides(['watch'], overrides)
}

export function taktMergeCommand(branch: string): string[] {
  return ['list', '--non-interactive', '--action', 'merge', '--branch', branch]
}

export function taktWorkflowDoctorCommand(name: string): string[] {
  return appendArgvUserPositionals(['workflow', 'doctor'], name)
}
