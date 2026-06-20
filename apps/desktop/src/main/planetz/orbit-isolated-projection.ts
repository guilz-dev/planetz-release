import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EngineConfig, UiConfig } from '@planetz/shared'
import {
  orbitFacetsPath,
  orbitImportSnapshotGlobalConfigPath,
  orbitImportSnapshotWorkflowsPath,
  orbitTaktGlobalPath,
  orbitWorkflowsPath,
  TAKT_COMPAT_DIR_NAME,
} from '@planetz/shared'
import { copyYamlDir, isIgnorableCopyError } from '../lib/copy-yaml-dir.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { resolveSidecarPaths } from '../sidecar/sidecar-store.js'
import {
  ensureBuiltinWorkflowCatalogLoaded,
  readBuiltinWorkflowYaml,
} from '../takt/builtin-workflow-registry.js'
import { ensureCanonicalDirWorkflowFacetsMaterialized } from '../takt/facet-resolver.js'
import { ensureBuiltinWorkflowFiles } from './planetz-builtin-workflow-seed.js'
import { buildTaktRuntimeEnv, syncPlanetzWorkflowsToTaktGlobal } from './takt-runtime-adapter.js'

async function copyFacetTree(srcDir: string, destDir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(srcDir)
  } catch {
    return
  }
  await mkdir(destDir, { recursive: true })
  for (const name of entries) {
    const from = join(srcDir, name)
    const to = join(destDir, name)
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(from)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      await copyFacetTree(from, to)
    } else if (info.isFile() && name.endsWith('.md')) {
      try {
        await cp(from, to)
      } catch (error) {
        if (!isIgnorableCopyError(error)) throw error
      }
    }
  }
}

async function forceIsolatedInternalRuntimeWorkflows(paths: SidecarPaths): Promise<void> {
  await ensureBuiltinWorkflowCatalogLoaded()
  const names = ['ollama-chat'] as const
  for (const name of names) {
    const yaml = readBuiltinWorkflowYaml(name)
    if (!yaml) continue
    await writeFile(join(paths.planetzWorkflowsDir, `${name}.yaml`), yaml, 'utf8')
  }
}

/**
 * Project main `.planetz/orbit` SSOT into the isolated repo before bundled takt runs.
 * Isolated `.takt` comes from git sync; this only refreshes Planetz-owned runtime shadows.
 */
export async function projectMainOrbitToIsolated(
  mainSidecar: SidecarPaths,
  mainWorkspacePath: string,
  isolatedRepoPath: string,
  engine: EngineConfig,
  config: UiConfig,
): Promise<SidecarPaths> {
  const isolatedSidecar = await resolveSidecarPaths(isolatedRepoPath)
  const mainFacetsRoot = orbitFacetsPath(mainWorkspacePath)
  const projectFacetsRoot = join(mainWorkspacePath, config.facetsDir)
  const isolatedFacetsRoot = join(isolatedRepoPath, TAKT_COMPAT_DIR_NAME, 'facets')

  await ensureCanonicalDirWorkflowFacetsMaterialized(
    mainFacetsRoot,
    mainSidecar.planetzWorkflowsDir,
    {
      fallbackFacetsRoot: projectFacetsRoot,
    },
  )

  await copyYamlDir(mainSidecar.planetzWorkflowsDir, isolatedSidecar.planetzWorkflowsDir)
  await ensureBuiltinWorkflowFiles(isolatedSidecar, 'runtime-fallback')
  await forceIsolatedInternalRuntimeWorkflows(isolatedSidecar)
  await syncPlanetzWorkflowsToTaktGlobal(isolatedSidecar)

  await copyFacetTree(mainFacetsRoot, isolatedFacetsRoot)

  await ensureCanonicalDirWorkflowFacetsMaterialized(
    isolatedFacetsRoot,
    isolatedSidecar.planetzWorkflowsDir,
    { fallbackFacetsRoot: mainFacetsRoot },
  )

  const snapshotWf = orbitImportSnapshotWorkflowsPath(mainWorkspacePath)
  await copyYamlDir(snapshotWf, join(orbitTaktGlobalPath(isolatedRepoPath), 'workflows'))

  const snapshotConfig = orbitImportSnapshotGlobalConfigPath(mainWorkspacePath)
  try {
    const snapshotYaml = await readFile(snapshotConfig, 'utf8')
    await mkdir(orbitTaktGlobalPath(isolatedRepoPath), { recursive: true })
    await writeFile(
      join(orbitTaktGlobalPath(isolatedRepoPath), 'config.yaml'),
      snapshotYaml,
      'utf8',
    )
  } catch {
    // no snapshot
  }

  await buildTaktRuntimeEnv(isolatedSidecar, engine, isolatedRepoPath)

  return isolatedSidecar
}

export function isolatedTaktRunsDir(isolatedRepoPath: string, runsDirRel: string): string {
  return join(isolatedRepoPath, runsDirRel)
}

export function isolatedOrbitWorkflowsPath(isolatedRepoPath: string): string {
  return orbitWorkflowsPath(isolatedRepoPath)
}
