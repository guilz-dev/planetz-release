import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  type CanonicalImportOffer,
  type EngineConfig,
  finalizeEngineConfigForPersist,
  HOME_TAKT_IMPORT_MARKER_FILENAME,
  normalizeUiPreferences,
  orbitFacetsPath,
  parseEngineConfigYaml,
  planetzWorkflowRelPath,
  type UiConfig,
} from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { EngineConfigStore } from './engine-config-store.js'
import {
  importGlobalTaktFromHome,
  isHomeGlobalImportAvailable,
  listTaktWorkflowImportCandidates,
  readTaktProjectConfig,
  resolveTaktWorkflowYaml,
} from './takt-import-sources.js'
export interface CanonicalBootstrapResult {
  engineConfigImported: boolean
  workflowsImported: string[]
}

async function saveEngineConfigWithUiDefaults(
  engineStore: EngineConfigStore,
  paths: SidecarPaths,
  config: UiConfig,
  engine: EngineConfig,
): Promise<EngineConfig> {
  const uiLanguage = normalizeUiPreferences(config.ui).language
  return engineStore.save(paths, finalizeEngineConfigForPersist(engine, uiLanguage))
}

/** Create `.planetz/orbit/workflows` and `.planetz/orbit/facets` dirs (does not create engine-config; see preview/import). */
export async function ensureCanonicalScaffold(
  paths: SidecarPaths,
  mainWorkspacePath?: string,
): Promise<void> {
  await mkdir(paths.planetzWorkflowsDir, { recursive: true })
  if (mainWorkspacePath) {
    await mkdir(orbitFacetsPath(mainWorkspacePath), { recursive: true })
  }
}

/** Empty engine config when user skipped import and no file exists yet. */
export async function ensureEmptyEngineConfigIfMissing(paths: SidecarPaths): Promise<void> {
  const engineStore = new EngineConfigStore()
  if (!(await engineStore.exists(paths))) {
    await engineStore.save(paths, {})
  }
}

async function listCanonicalWorkflowNames(paths: SidecarPaths): Promise<Set<string>> {
  try {
    const files = await readdir(paths.planetzWorkflowsDir)
    return new Set(
      files
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map((f) => basename(f).replace(/\.(yaml|yml)$/i, '')),
    )
  } catch {
    return new Set()
  }
}

/** Detect import candidates when canonical files are absent (does not write `.takt/*`). */
export async function previewCanonicalImport(
  mainWorkspacePath: string,
  config: UiConfig,
  paths: SidecarPaths,
  options?: { taktRepoPath?: string },
): Promise<CanonicalImportOffer | null> {
  const engineStore = new EngineConfigStore()
  const taktRepo = options?.taktRepoPath ?? mainWorkspacePath
  const taktConfig = await readTaktProjectConfig(taktRepo, config)
  const engineConfig = !(await engineStore.exists(paths)) && Boolean(taktConfig?.trim())

  const existingNames = await listCanonicalWorkflowNames(paths)
  const workflows: string[] = []

  const defaultCandidate = await resolveTaktWorkflowYaml(mainWorkspacePath, config, 'default', {
    taktRepoPath: options?.taktRepoPath,
  })
  if (defaultCandidate && !existingNames.has('default')) {
    workflows.push('default')
    existingNames.add('default')
  }
  for (const c of await listTaktWorkflowImportCandidates(mainWorkspacePath, config, undefined, {
    taktRepoPath: options?.taktRepoPath,
  })) {
    if (existingNames.has(c.name)) continue
    workflows.push(c.name)
    existingNames.add(c.name)
  }

  const homeGlobalAvailable = await isHomeGlobalImportAvailable(paths.root)
  if (!engineConfig && workflows.length === 0 && !homeGlobalAvailable) return null

  return {
    engineConfig,
    workflows,
    ...(homeGlobalAvailable ? { homeGlobalAvailable: true } : {}),
  }
}

/** Apply one-shot import from project compat layers into the sidecar root (`.planetz/orbit`). */
export async function applyCanonicalImport(
  mainWorkspacePath: string,
  config: UiConfig,
  paths: SidecarPaths,
  offer: CanonicalImportOffer,
  options?: { taktRepoPath?: string },
): Promise<CanonicalBootstrapResult> {
  const engineStore = new EngineConfigStore()
  let engineConfigImported = false
  const workflowsImported: string[] = []

  await mkdir(paths.planetzWorkflowsDir, { recursive: true })

  if (offer.engineConfig && !(await engineStore.exists(paths))) {
    const taktRepo = options?.taktRepoPath ?? mainWorkspacePath
    const taktYaml = await readTaktProjectConfig(taktRepo, config)
    if (taktYaml?.trim()) {
      await saveEngineConfigWithUiDefaults(
        engineStore,
        paths,
        config,
        parseEngineConfigYaml(parseYaml(taktYaml)),
      )
      engineConfigImported = true
    } else {
      await saveEngineConfigWithUiDefaults(engineStore, paths, config, {})
    }
  }

  for (const name of offer.workflows) {
    const target = join(paths.planetzWorkflowsDir, `${name}.yaml`)
    try {
      await readFile(target, 'utf8')
      continue
    } catch {
      // missing — import below
    }
    const candidate = await resolveTaktWorkflowYaml(mainWorkspacePath, config, name, {
      taktRepoPath: options?.taktRepoPath,
    })
    if (!candidate) continue
    await writeFile(target, candidate.yaml, 'utf8')
    workflowsImported.push(name)
  }

  if (offer.importHomeGlobal) {
    const homeMarker = join(paths.root, HOME_TAKT_IMPORT_MARKER_FILENAME)
    try {
      await readFile(homeMarker, 'utf8')
    } catch {
      await importGlobalTaktFromHome(mainWorkspacePath)
      await writeFile(homeMarker, 'imported\n', 'utf8')
    }
  }

  return { engineConfigImported, workflowsImported }
}

/** Scaffold + optional import (used by tests and explicit confirm). */
export async function ensureCanonicalBootstrap(
  mainWorkspacePath: string,
  config: UiConfig,
  paths: SidecarPaths,
  options?: { importOffer?: CanonicalImportOffer | null; taktRepoPath?: string },
): Promise<CanonicalBootstrapResult> {
  await ensureCanonicalScaffold(paths)
  const offer =
    options?.importOffer ??
    (await previewCanonicalImport(mainWorkspacePath, config, paths, {
      taktRepoPath: options?.taktRepoPath,
    }))
  if (!offer) {
    return { engineConfigImported: false, workflowsImported: [] }
  }
  return applyCanonicalImport(mainWorkspacePath, config, paths, offer, {
    taktRepoPath: options?.taktRepoPath,
  })
}

export async function importEngineConfigFromTakt(
  mainWorkspacePath: string,
  config: UiConfig,
  paths: SidecarPaths,
  options?: { overwrite?: boolean; taktRepoPath?: string },
): Promise<{ yaml: string; overwritten: boolean }> {
  const engineStore = new EngineConfigStore()
  const hadExisting = await engineStore.exists(paths)
  if (hadExisting && !options?.overwrite) {
    const current = await readFile(paths.engineConfigPath, 'utf8')
    return { yaml: current, overwritten: false }
  }
  const taktRepo = options?.taktRepoPath ?? mainWorkspacePath
  const taktYaml = await readTaktProjectConfig(taktRepo, config)
  if (!taktYaml?.trim()) {
    throw new Error('No project .takt/config.yaml found in the execution repo to import')
  }
  const parsed = parseEngineConfigYaml(parseYaml(taktYaml))
  const saved = await saveEngineConfigWithUiDefaults(engineStore, paths, config, parsed)
  return { yaml: stringifyYaml(saved, { lineWidth: 0 }), overwritten: hadExisting }
}

/** Re-import `~/.takt` into main `.planetz/orbit/import-snapshot` (settings; optional overwrite). */
export async function importGlobalTaktFromHomeForWorkspace(
  workspacePath: string,
  paths: SidecarPaths,
  options?: { overwrite?: boolean },
): Promise<{ configImported: boolean; workflowsImported: string[] }> {
  const result = await importGlobalTaktFromHome(workspacePath, options)
  const homeMarker = join(paths.root, HOME_TAKT_IMPORT_MARKER_FILENAME)
  try {
    await readFile(homeMarker, 'utf8')
  } catch {
    await writeFile(homeMarker, 'imported\n', 'utf8')
  }
  return result
}

export async function importWorkflowFromTakt(
  mainWorkspacePath: string,
  config: UiConfig,
  paths: SidecarPaths,
  workflowName: string,
  options?: { overwrite?: boolean; taktRepoPath?: string },
): Promise<{ path: string; overwritten: boolean }> {
  const trimmed = workflowName.trim()
  const target = join(paths.planetzWorkflowsDir, `${trimmed}.yaml`)
  let overwritten = false
  try {
    await readFile(target, 'utf8')
    overwritten = true
    if (!options?.overwrite) {
      return { path: planetzWorkflowRelPath(trimmed), overwritten: false }
    }
  } catch {
    overwritten = false
  }
  const candidate = await resolveTaktWorkflowYaml(mainWorkspacePath, config, trimmed, {
    taktRepoPath: options?.taktRepoPath,
  })
  if (!candidate) {
    throw new Error(`Workflow not found in takt layers: ${trimmed}`)
  }
  await mkdir(paths.planetzWorkflowsDir, { recursive: true })
  await writeFile(target, candidate.yaml, 'utf8')
  return { path: planetzWorkflowRelPath(trimmed), overwritten }
}
