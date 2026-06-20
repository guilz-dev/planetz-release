import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  type EngineConfig,
  ORBIT_RUNTIME_WORKFLOWS_DIRNAME,
  ORBIT_TAKT_GLOBAL_DIRNAME,
  orbitRootPath,
  orbitRuntimeWorkflowRelPath,
  orbitTaktGlobalPath,
  orbitWorkflowRelPath,
  orbitWorkflowsPath,
  PLANETZ_WORKFLOWS_DIRNAME,
} from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { copyYamlDir } from '../lib/copy-yaml-dir.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { TaktAgentCliOverrides } from '../takt/commands.js'
import { resolveProviderRuntimeEnv } from './provider-runtime-env.js'
import { materializeTaktGlobalConfigFields } from './takt-global-config-fields.js'
import { recordTaktPathAccess } from './takt-path-telemetry.js'
import type { PlanetzWorkflowCanonicalManager } from './workflow-canonical-manager.js'

function toWorkflowName(nameOrPath: string | undefined): string {
  const raw = nameOrPath?.trim() || COMPOSER_DEFAULT_WORKFLOW_NAME
  const base = basename(raw)
  return base.replace(/\.(yaml|yml)$/i, '') || COMPOSER_DEFAULT_WORKFLOW_NAME
}

function runtimeWorkflowIdentifier(paths: SidecarPaths, name: string): string {
  if (paths.isWorkspaceLocal) {
    return orbitRuntimeWorkflowRelPath(name)
  }
  return join(paths.root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME, `${name}.yaml`)
}

/** `TAKT_CONFIG_DIR/workflows` — bundled takt resolves short workflow names here. */
export function taktGlobalWorkflowsDir(paths: SidecarPaths): string {
  return join(paths.root, ORBIT_TAKT_GLOBAL_DIRNAME, PLANETZ_WORKFLOWS_DIRNAME)
}

/** Write one workflow under `takt-global/workflows` for short-name lookup at `takt run`. */
export async function syncWorkflowYamlToTaktGlobal(
  paths: SidecarPaths,
  name: string,
  yaml: string,
): Promise<void> {
  const dir = taktGlobalWorkflowsDir(paths)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${name}.yaml`), yaml, 'utf8')
}

/** Copy all workflow YAML from a directory into `takt-global/workflows`. */
export async function syncWorkflowYamlDirToTaktGlobal(
  paths: SidecarPaths,
  srcDir: string,
): Promise<void> {
  await copyYamlDir(srcDir, taktGlobalWorkflowsDir(paths))
}

/** Mirror canonical Planetz workflows into `TAKT_CONFIG_DIR/workflows`. */
export async function syncPlanetzWorkflowsToTaktGlobal(paths: SidecarPaths): Promise<void> {
  await syncWorkflowYamlDirToTaktGlobal(paths, paths.planetzWorkflowsDir)
}

export interface RuntimeWorkflowResolution {
  workflow: string
  yaml: string
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function ensureRuntimeFallbackYaml(yaml: string, engine: EngineConfig): string {
  const switchChain = engine.rate_limit_fallback?.switch_chain
  if (!switchChain || switchChain.length === 0) return yaml

  const parsed = parseYaml(yaml)
  const root = asObject(parsed)
  if (!root) return yaml

  const existingFallback = asObject(root.rate_limit_fallback)
  if (existingFallback?.switch_chain) return yaml

  root.rate_limit_fallback = { switch_chain: switchChain }
  return stringifyYaml(root, { lineWidth: 0 })
}

/**
 * Resolve a workflow identifier that takt can execute from workspace root.
 * Canonical `.planetz/orbit/workflows/<name>.yaml` is materialized on demand.
 */
export async function resolveRuntimeWorkflow(
  manager: PlanetzWorkflowCanonicalManager,
  paths: SidecarPaths,
  engine: EngineConfig,
  nameOrPath?: string,
  workspacePath?: string,
): Promise<RuntimeWorkflowResolution> {
  const name = toWorkflowName(nameOrPath)

  let yaml = await manager.readCanonicalYaml(name)
  if (!yaml) {
    const loaded = await manager.read(nameOrPath?.trim() || name)
    yaml = loaded.yaml
    await mkdir(paths.planetzWorkflowsDir, { recursive: true })
    await writeFile(join(paths.planetzWorkflowsDir, `${name}.yaml`), yaml, 'utf8')
    manager.invalidateListCache()
  }

  const runtimeYaml = ensureRuntimeFallbackYaml(yaml, engine)
  const runtimeDir = join(paths.root, ORBIT_RUNTIME_WORKFLOWS_DIRNAME)
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(join(runtimeDir, `${name}.yaml`), runtimeYaml, 'utf8')
  await syncWorkflowYamlToTaktGlobal(paths, name, runtimeYaml)

  if (workspacePath) {
    recordTaktPathAccess(
      'orbit_workflows',
      orbitWorkflowsPath(workspacePath),
      'resolveRuntimeWorkflow',
    )
  }

  return {
    workflow: runtimeWorkflowIdentifier(paths, name),
    yaml: runtimeYaml,
  }
}

/**
 * Build takt runtime env with workspace-scoped `TAKT_CONFIG_DIR` (never `~/.takt` at runtime).
 */
export async function buildTaktRuntimeEnv(
  paths: SidecarPaths,
  engine: EngineConfig,
  workspacePath?: string,
): Promise<Record<string, string>> {
  const ws = workspacePath ?? null
  const configDir =
    ws && paths.isWorkspaceLocal
      ? orbitTaktGlobalPath(ws)
      : join(paths.root, ORBIT_TAKT_GLOBAL_DIRNAME)
  recordTaktPathAccess('orbit_takt_global', configDir, 'buildTaktRuntimeEnv')
  await mkdir(configDir, { recursive: true })

  const configPath = join(configDir, 'config.yaml')
  let mergedConfig: Record<string, unknown> = {}
  try {
    const baseRaw = await readFile(configPath, 'utf8')
    const parsed = parseYaml(baseRaw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      mergedConfig = { ...(parsed as Record<string, unknown>) }
    }
  } catch {
    mergedConfig = {}
  }

  const hasPersonaProviders =
    !!engine.persona_providers && Object.keys(engine.persona_providers).length > 0
  const configYaml = materializeTaktGlobalConfigFields(engine, mergedConfig)
  await writeFile(configPath, stringifyYaml(configYaml, { lineWidth: 0 }), 'utf8')

  const env: Record<string, string> = {
    TAKT_CONFIG_DIR: configDir,
    ...resolveProviderRuntimeEnv(engine),
  }
  if (hasPersonaProviders) {
    env.TAKT_PERSONA_PROVIDERS = JSON.stringify(engine.persona_providers)
  }
  return env
}

/** CLI `--provider` / `--model` flags for `takt watch`, aligned with engine-config. */
export function watchCliOverridesFromEngine(
  engine: EngineConfig,
): TaktAgentCliOverrides | undefined {
  const provider = engine.provider?.trim()
  const model = engine.model?.trim()
  if (!provider && !model) return undefined
  return {
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  }
}

/** Minimal env for bundled takt CLI calls that are not on the execution profile path. */
export async function buildWorkspaceBundledTaktEnv(
  workspacePath: string,
  engine: EngineConfig = {},
): Promise<Record<string, string>> {
  const stub = {
    root: orbitRootPath(workspacePath),
    isWorkspaceLocal: true,
  } as SidecarPaths
  return buildTaktRuntimeEnv(stub, engine, workspacePath)
}

/** Re-export for callers that need display-relative workflow paths. */
export { orbitWorkflowRelPath }
