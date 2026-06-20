/** Orbit / takt `ProviderType` ids (bundled engine). */
export const ORBIT_PROVIDER_IDS = [
  'claude',
  'claude-sdk',
  'claude-terminal',
  'codex',
  'opencode',
  'cursor',
  'copilot',
  'ollama',
  'mock',
] as const

export type OrbitProviderId = (typeof ORBIT_PROVIDER_IDS)[number]

const PROVIDER_SET = new Set<string>(ORBIT_PROVIDER_IDS)

/** Common model ids per provider (hints when workspace has no configured models). */
export const ORBIT_MODEL_HINTS: Partial<Record<OrbitProviderId, readonly string[]>> = {
  claude: ['sonnet', 'opus', 'haiku'],
  'claude-sdk': ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-4'],
  'claude-terminal': ['sonnet', 'opus'],
  opencode: ['opencode/claude-sonnet-4', 'opencode/gpt-4.1'],
  cursor: ['auto', 'composer-2', 'gpt-5'],
  ollama: ['llama3.2:latest', 'qwen2.5:7b'],
  mock: ['mock-model'],
}

export function isOrbitProviderId(value: string | undefined): value is OrbitProviderId {
  const id = value?.trim()
  return id != null && id.length > 0 && PROVIDER_SET.has(id)
}

export function orbitProviderDisplayLabel(id: OrbitProviderId): string {
  switch (id) {
    case 'claude':
      return 'Claude (CLI)'
    case 'claude-sdk':
      return 'Claude (API)'
    case 'claude-terminal':
      return 'Claude (Terminal)'
    case 'codex':
      return 'Codex'
    case 'opencode':
      return 'OpenCode'
    case 'cursor':
      return 'Cursor'
    case 'copilot':
      return 'GitHub Copilot'
    case 'ollama':
      return 'Ollama (local)'
    case 'mock':
      return 'Mock (dev)'
    default:
      return id
  }
}

export function modelHintsForOrbitProvider(provider: string | undefined): readonly string[] {
  if (!provider || !isOrbitProviderId(provider)) return []
  return ORBIT_MODEL_HINTS[provider] ?? []
}
