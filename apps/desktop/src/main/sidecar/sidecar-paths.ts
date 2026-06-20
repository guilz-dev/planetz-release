import { createHash } from 'node:crypto'
import { access, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHAINS_FILENAME,
  CONVERSATIONS_FILENAME,
  EFFORT_HISTORY_FILENAME,
  LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
  MOCK_QUEUE_FILENAME,
  MODEL_HISTORY_FILENAME,
  orbitRootPath,
  PLANETZ_AGENT_OVERRIDES_FILENAME,
  PLANETZ_AGENTS_DIRNAME,
  PLANETZ_ENGINE_CONFIG_FILENAME,
  PLANETZ_SIDECAR_DIR_BASENAME,
  PLANETZ_SQLITE_FILENAME,
  PLANETZ_WORKFLOWS_DIRNAME,
  RETRY_CONTEXTS_FILENAME,
  WATCH_STATE_FILENAME,
} from '@planetz/shared'
import { app } from 'electron'

const SIDECAR_CONFIG_FILENAME = 'config.json'

export interface SidecarPaths {
  root: string
  /** Legacy JSON config path for backwards readability; runtime SSOT is SQLite. */
  configPath: string
  engineConfigPath: string
  agentOverridesPath: string
  planetzWorkflowsDir: string
  /** SQLite sidecar database (runtime SSOT for UI state / history). */
  sqlitePath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  uiStatePath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  promptHistoryPath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  modelHistoryPath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  effortHistoryPath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  mockQueuePath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  conversationsPath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  retryContextsPath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  chainsPath: string
  /** @deprecated Legacy JSON path. Runtime SSOT is `planetz.db`. Field removal is a follow-up. */
  watchStatePath: string
  isWorkspaceLocal: boolean
}

function workspaceHash(workspacePath: string): string {
  return createHash('sha256').update(workspacePath).digest('hex').slice(0, 16)
}

function buildSidecarPaths(root: string, isWorkspaceLocal: boolean): SidecarPaths {
  return {
    root,
    configPath: join(root, SIDECAR_CONFIG_FILENAME),
    engineConfigPath: join(root, PLANETZ_ENGINE_CONFIG_FILENAME),
    agentOverridesPath: join(root, PLANETZ_AGENTS_DIRNAME, PLANETZ_AGENT_OVERRIDES_FILENAME),
    planetzWorkflowsDir: join(root, PLANETZ_WORKFLOWS_DIRNAME),
    sqlitePath: join(root, PLANETZ_SQLITE_FILENAME),
    uiStatePath: join(root, 'ui-state.json'),
    promptHistoryPath: join(root, 'prompt-history.json'),
    modelHistoryPath: join(root, MODEL_HISTORY_FILENAME),
    effortHistoryPath: join(root, EFFORT_HISTORY_FILENAME),
    mockQueuePath: join(root, MOCK_QUEUE_FILENAME),
    conversationsPath: join(root, CONVERSATIONS_FILENAME),
    retryContextsPath: join(root, RETRY_CONTEXTS_FILENAME),
    chainsPath: join(root, CHAINS_FILENAME),
    watchStatePath: join(root, WATCH_STATE_FILENAME),
    isWorkspaceLocal,
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function sidecarHasConfig(root: string): Promise<boolean> {
  return pathExists(join(root, SIDECAR_CONFIG_FILENAME))
}

async function sidecarRootSignals(root: string): Promise<{ hasData: boolean; exists: boolean }> {
  const [hasDb, hasConfig, exists] = await Promise.all([
    pathExists(join(root, PLANETZ_SQLITE_FILENAME)),
    sidecarHasConfig(root),
    pathExists(root),
  ])
  return { hasData: hasDb || hasConfig, exists }
}

async function resolveExistingSidecarRoot(candidates: readonly string[]): Promise<string | null> {
  const signals = await Promise.all(
    candidates.map(async (root) => ({ root, ...(await sidecarRootSignals(root)) })),
  )

  for (const signal of signals) {
    if (signal.hasData) return signal.root
  }

  for (const signal of signals) {
    if (signal.exists) return signal.root
  }

  return null
}

/**
 * Resolve workspace-local sidecar root.
 * Priority:
 * 1) first candidate with persisted data (`planetz.db` or `config.json`), in canonical-then-legacy order
 * 2) first existing empty directory, in the same order
 * 3) create and use canonical `.planetz/orbit`
 */
export async function resolveWorkspaceSidecarRoot(workspacePath: string): Promise<string> {
  const canonical = orbitRootPath(workspacePath)
  const typoLegacy = join(
    workspacePath,
    LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
    PLANETZ_SIDECAR_DIR_BASENAME,
  )

  const existing = await resolveExistingSidecarRoot([canonical, typoLegacy])
  if (existing) return existing

  await mkdir(canonical, { recursive: true })
  return canonical
}

export async function resolveSidecarPaths(workspacePath: string): Promise<SidecarPaths> {
  try {
    const localRoot = await resolveWorkspaceSidecarRoot(workspacePath)
    return buildSidecarPaths(localRoot, true)
  } catch {
    const fallbackRoot = join(app.getPath('userData'), 'workspaces', workspaceHash(workspacePath))
    await mkdir(fallbackRoot, { recursive: true })
    return buildSidecarPaths(fallbackRoot, false)
  }
}
