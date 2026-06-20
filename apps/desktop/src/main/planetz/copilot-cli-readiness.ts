import { execa } from 'execa'

const COPILOT_AUTH_KEYS = [
  'TAKT_COPILOT_GITHUB_TOKEN',
  'COPILOT_GITHUB_TOKEN',
  'GITHUB_TOKEN',
  'GH_TOKEN',
] as const

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

function isAwsCopilotCliHelp(helpText: string): boolean {
  const normalized = helpText.toLowerCase()
  return (
    normalized.includes('amazon ecs') ||
    normalized.includes('aws fargate') ||
    normalized.includes('containerized applications on aws')
  )
}

/** Distinguish GitHub Copilot CLI from AWS Copilot CLI (both use `copilot` on PATH). */
export async function isGitHubCopilotCliAvailable(): Promise<boolean> {
  if (!(await commandExists('copilot'))) return false
  try {
    const result = await execa('copilot', ['--help'], {
      reject: false,
      timeout: 4_000,
    })
    const helpText = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    if (isAwsCopilotCliHelp(helpText)) return false
    const normalized = helpText.toLowerCase()
    return normalized.includes('github') || normalized.includes('@github/copilot')
  } catch {
    return false
  }
}

async function isGhAuthLoggedIn(): Promise<boolean> {
  if (!(await commandExists('gh'))) return false
  try {
    const result = await execa('gh', ['auth', 'status'], {
      reject: false,
      timeout: 4_000,
    })
    return result.exitCode === 0
  } catch {
    return false
  }
}

/** Whether Copilot auth env or `gh auth` is available (runtime provider detection). */
export async function isCopilotAuthReady(): Promise<boolean> {
  return hasNonEmptyEnv(COPILOT_AUTH_KEYS) || (await isGhAuthLoggedIn())
}

/** GitHub Copilot CLI present and auth probe passes (runtime provider detection). */
export async function isCopilotRuntimeReady(): Promise<boolean> {
  const copilotCliReady = await isGitHubCopilotCliAvailable()
  if (!copilotCliReady) return false
  return isCopilotAuthReady()
}
