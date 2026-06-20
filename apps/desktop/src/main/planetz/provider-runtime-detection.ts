import { isOrbitProviderId, type OrbitProviderId } from '@planetz/shared'
import { execa } from 'execa'
import { isCopilotRuntimeReady } from './copilot-cli-readiness.js'
import { fetchOllamaLiveModels } from './ollama-model-discovery.js'

const CLI_PROVIDER_COMMANDS: ReadonlyArray<{ provider: OrbitProviderId; command: string }> = [
  { provider: 'claude', command: 'claude' },
  { provider: 'claude-terminal', command: 'claude' },
  { provider: 'codex', command: 'codex' },
  { provider: 'opencode', command: 'opencode' },
  { provider: 'cursor', command: 'cursor-agent' },
]

const ENV_PROVIDER_KEYS: ReadonlyArray<{ provider: OrbitProviderId; keys: readonly string[] }> = [
  { provider: 'claude-sdk', keys: ['TAKT_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'] },
  { provider: 'codex', keys: ['TAKT_OPENAI_API_KEY', 'OPENAI_API_KEY'] },
  { provider: 'opencode', keys: ['TAKT_OPENCODE_API_KEY'] },
]

async function commandExists(command: string): Promise<boolean> {
  const resolver = process.platform === 'win32' ? 'where' : 'which'
  try {
    const result = await execa(resolver, [command], {
      reject: false,
      timeout: 4_000,
    })
    return result.exitCode === 0
  } catch {
    return false
  }
}

function hasNonEmptyEnv(keys: readonly string[]): boolean {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim().length > 0) return true
  }
  return false
}

async function isOllamaRuntimeAvailable(): Promise<boolean> {
  const live = await fetchOllamaLiveModels({ refresh: false })
  return !live.error
}

/**
 * Detect providers executable in the user environment (CLI / env / auth probe).
 * This complements workspace YAML-driven detection used by ExecutionCatalog.
 */
export async function detectRuntimeProviderIds(): Promise<OrbitProviderId[]> {
  const detected = new Set<OrbitProviderId>()

  await Promise.all(
    CLI_PROVIDER_COMMANDS.map(async ({ provider, command }) => {
      if (await commandExists(command)) detected.add(provider)
    }),
  )

  for (const { provider, keys } of ENV_PROVIDER_KEYS) {
    if (hasNonEmptyEnv(keys)) detected.add(provider)
  }
  if (await isCopilotRuntimeReady()) {
    detected.add('copilot')
  }
  if (await isOllamaRuntimeAvailable()) {
    detected.add('ollama')
  }

  return [...detected].filter(isOrbitProviderId).sort((a, b) => a.localeCompare(b))
}
