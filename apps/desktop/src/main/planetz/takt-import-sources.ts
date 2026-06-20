import { access, cp, mkdir, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import {
  HOME_TAKT_IMPORT_MARKER_FILENAME,
  orbitImportSnapshotGlobalConfigPath,
  orbitImportSnapshotWorkflowsPath,
  orbitRootPath,
  orbitWorkflowsDirRelPath,
  orbitWorkflowsPath,
} from '@planetz/shared'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  readBuiltinWorkflowYaml,
} from '../takt/builtin-workflow-registry.js'
import { recordTaktPathAccess } from './takt-path-telemetry.js'

export type TaktImportLayer = 'orbit' | 'project' | 'builtin'

export interface TaktWorkflowImportCandidate {
  name: string
  layer: TaktImportLayer
  yaml: string
  path?: string
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readYamlFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function scanWorkflowDir(
  dir: string,
  layer: TaktImportLayer,
  relPrefix: string,
): Promise<TaktWorkflowImportCandidate[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  const out: TaktWorkflowImportCandidate[] = []
  for (const file of files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
    const name = basename(file).replace(/\.(yaml|yml)$/i, '')
    const abs = join(dir, file)
    const yaml = await readYamlFile(abs)
    if (!yaml?.trim()) continue
    out.push({
      name,
      layer,
      yaml,
      path: join(relPrefix, file).replace(/\\/g, '/'),
    })
  }
  return out
}

/** Read project `config.yaml` from a takt repo root (typically the isolated execution repo). */
export async function readTaktProjectConfig(
  repoPath: string,
  config: UiConfig,
): Promise<string | null> {
  return readYamlFile(join(repoPath, config.taktConfigPath))
}

async function scanOrbitCanonicalWorkflows(
  workspacePath: string,
): Promise<TaktWorkflowImportCandidate[]> {
  const dir = orbitWorkflowsPath(workspacePath)
  recordTaktPathAccess('orbit_workflows', dir, 'scanOrbitCanonicalWorkflows')
  return scanWorkflowDir(dir, 'orbit', orbitWorkflowsDirRelPath())
}

async function scanTaktRepoProjectWorkflows(
  taktRepoPath: string,
  config: UiConfig,
): Promise<TaktWorkflowImportCandidate[]> {
  const rel = config.workflowsDir.replace(/\\/g, '/')
  const dir = join(taktRepoPath, config.workflowsDir)
  recordTaktPathAccess('project_dot_takt', dir, 'scanTaktRepoProjectWorkflows')
  return scanWorkflowDir(dir, 'project', rel)
}

export async function listTaktWorkflowImportCandidates(
  mainWorkspacePath: string,
  config: UiConfig,
  workflowName?: string,
  options?: { taktRepoPath?: string },
): Promise<TaktWorkflowImportCandidate[]> {
  const layers: TaktWorkflowImportCandidate[] = [
    ...(await scanOrbitCanonicalWorkflows(mainWorkspacePath)),
  ]
  if (options?.taktRepoPath) {
    layers.push(...(await scanTaktRepoProjectWorkflows(options.taktRepoPath, config)))
  }

  if (workflowName) {
    const named = layers.filter((c) => c.name === workflowName)
    if (named.length > 0) return named
    await ensureBuiltinWorkflowCatalogLoaded()
    const builtinYaml = readBuiltinWorkflowYaml(workflowName)
    if (builtinYaml) {
      return [{ name: workflowName, layer: 'builtin', yaml: builtinYaml }]
    }
    return []
  }

  const byName = new Map<string, TaktWorkflowImportCandidate>()
  for (const c of layers) {
    if (!byName.has(c.name)) byName.set(c.name, c)
  }
  return [...byName.values()]
}

export async function resolveTaktWorkflowYaml(
  mainWorkspacePath: string,
  config: UiConfig,
  workflowName: string,
  options?: { taktRepoPath?: string },
): Promise<TaktWorkflowImportCandidate | null> {
  const orbitPath = join(orbitWorkflowsPath(mainWorkspacePath), `${workflowName}.yaml`)
  if (await fileExists(orbitPath)) {
    const yaml = await readYamlFile(orbitPath)
    if (yaml) {
      recordTaktPathAccess('orbit_workflows', orbitPath, 'resolveTaktWorkflowYaml')
      return {
        name: workflowName,
        layer: 'orbit',
        yaml,
        path: `${orbitWorkflowsDirRelPath()}/${workflowName}.yaml`,
      }
    }
  }

  if (options?.taktRepoPath) {
    const projectPath = join(options.taktRepoPath, config.workflowsDir, `${workflowName}.yaml`)
    if (await fileExists(projectPath)) {
      const yaml = await readYamlFile(projectPath)
      if (yaml) {
        return {
          name: workflowName,
          layer: 'project',
          yaml,
          path: join(config.workflowsDir, `${workflowName}.yaml`).replace(/\\/g, '/'),
        }
      }
    }
  }

  await ensureBuiltinWorkflowCatalogLoaded()
  const builtinYaml = readBuiltinWorkflowYaml(workflowName)
  if (builtinYaml) {
    return { name: workflowName, layer: 'builtin', yaml: builtinYaml }
  }
  return null
}

/** Import from `~/.takt` into main `.planetz/orbit/import-snapshot` (wizard or settings, user-confirmed). */
export async function importGlobalTaktFromHome(
  mainWorkspacePath: string,
  options?: { overwrite?: boolean },
): Promise<{
  configImported: boolean
  workflowsImported: string[]
}> {
  const homeTakt = join(homedir(), '.takt')
  recordTaktPathAccess('home_dot_takt', homeTakt, 'importGlobalTaktFromHome')

  const destConfig = orbitImportSnapshotGlobalConfigPath(mainWorkspacePath)
  const destWorkflows = orbitImportSnapshotWorkflowsPath(mainWorkspacePath)
  await mkdir(orbitRootPath(mainWorkspacePath), { recursive: true })
  await mkdir(join(orbitRootPath(mainWorkspacePath), 'import-snapshot'), { recursive: true })
  await mkdir(destWorkflows, { recursive: true })

  const overwrite = options?.overwrite === true
  let configImported = false
  const homeConfig = join(homeTakt, 'config.yaml')
  if (await fileExists(homeConfig)) {
    if (overwrite || !(await fileExists(destConfig))) {
      await cp(homeConfig, destConfig)
      configImported = true
    }
  }

  const workflowsImported: string[] = []
  const homeWorkflows = join(homeTakt, 'workflows')
  let files: string[]
  try {
    files = await readdir(homeWorkflows)
  } catch {
    return { configImported, workflowsImported }
  }
  for (const file of files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))) {
    const name = basename(file).replace(/\.(yaml|yml)$/i, '')
    const dest = join(destWorkflows, file)
    if (overwrite || !(await fileExists(dest))) {
      await cp(join(homeWorkflows, file), dest)
      workflowsImported.push(name)
    }
  }
  return { configImported, workflowsImported }
}

/** True when `~/.takt` has importable content and the workspace has not imported it yet. */
export async function isHomeGlobalImportAvailable(sidecarRoot: string): Promise<boolean> {
  const marker = join(sidecarRoot, HOME_TAKT_IMPORT_MARKER_FILENAME)
  if (await fileExists(marker)) return false

  const homeTakt = join(homedir(), '.takt')
  recordTaktPathAccess('home_dot_takt', homeTakt, 'isHomeGlobalImportAvailable')
  if (await fileExists(join(homeTakt, 'config.yaml'))) return true

  try {
    const files = await readdir(join(homeTakt, 'workflows'))
    return files.some((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch {
    return false
  }
}
