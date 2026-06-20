import { PLANETZ_WORKFLOWS_DIRNAME } from './canonical-paths.js'
import { ORBIT_IMPORT_SNAPSHOT_DIRNAME, SIDECAR_DIR_NAME } from './constants.js'

/** Workspace-local takt global config root (`TAKT_CONFIG_DIR` target). */
export const ORBIT_TAKT_GLOBAL_DIRNAME = 'takt-global'

/** @deprecated Legacy shim layout; main workspace SSOT is `.planetz/orbit/` only. Isolated repo uses `.takt/`. */
export const ORBIT_TAKT_PROJECT_DIRNAME = 'takt-project'

export const ORBIT_CACHE_DIRNAME = '.cache'

export const ORBIT_DRAFTS_DIRNAME = 'planetz-drafts'

/** Planetz-owned project facet master files (SSOT on main workspace). */
export const ORBIT_FACETS_DIRNAME = 'facets'

/** Runtime-only generated workflow YAMLs for bundled takt execution. */
export const ORBIT_RUNTIME_WORKFLOWS_DIRNAME = 'runtime-workflows'

/** takt project layout directory name (lives under each git repo root, including isolated repo). */
export const TAKT_COMPAT_DIR_NAME = '.takt'

function workspacePathJoin(workspacePath: string, ...segments: string[]): string {
  const sep = workspacePath.includes('\\') ? '\\' : '/'
  const base = workspacePath.replace(/[/\\]+$/, '')
  const normalizedSegments = segments.flatMap((segment) =>
    segment.split(/[/\\]+/).filter((part) => part.length > 0),
  )
  return [base, ...normalizedSegments].join(sep)
}

export function orbitRootPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME)
}

export function orbitTaktGlobalPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, ORBIT_TAKT_GLOBAL_DIRNAME)
}

export function orbitImportSnapshotPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, ORBIT_IMPORT_SNAPSHOT_DIRNAME)
}

export function orbitImportSnapshotGlobalConfigPath(workspacePath: string): string {
  return workspacePathJoin(
    workspacePath,
    SIDECAR_DIR_NAME,
    ORBIT_IMPORT_SNAPSHOT_DIRNAME,
    'global-config.yaml',
  )
}

export function orbitTaktProjectPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, ORBIT_TAKT_PROJECT_DIRNAME)
}

export function orbitImportSnapshotWorkflowsPath(workspacePath: string): string {
  return workspacePathJoin(
    workspacePath,
    SIDECAR_DIR_NAME,
    ORBIT_IMPORT_SNAPSHOT_DIRNAME,
    PLANETZ_WORKFLOWS_DIRNAME,
  )
}

export function orbitImportSnapshotFacetsPath(workspacePath: string): string {
  return workspacePathJoin(
    workspacePath,
    SIDECAR_DIR_NAME,
    ORBIT_IMPORT_SNAPSHOT_DIRNAME,
    ORBIT_FACETS_DIRNAME,
  )
}

export function orbitWorkflowsPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, PLANETZ_WORKFLOWS_DIRNAME)
}

export function orbitRuntimeWorkflowsPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, ORBIT_RUNTIME_WORKFLOWS_DIRNAME)
}

export function orbitFacetsPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, ORBIT_FACETS_DIRNAME)
}

export function orbitTaktGlobalWorkflowsPath(workspacePath: string): string {
  return workspacePathJoin(
    workspacePath,
    SIDECAR_DIR_NAME,
    ORBIT_TAKT_GLOBAL_DIRNAME,
    PLANETZ_WORKFLOWS_DIRNAME,
  )
}

export function orbitDraftsPath(workspacePath: string): string {
  return workspacePathJoin(
    workspacePath,
    SIDECAR_DIR_NAME,
    ORBIT_CACHE_DIRNAME,
    ORBIT_DRAFTS_DIRNAME,
  )
}

export function taktCompatPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, TAKT_COMPAT_DIR_NAME)
}

export function orbitEngineConfigRelPath(): string {
  return `${SIDECAR_DIR_NAME}/engine-config.yaml`
}

export function orbitWorkflowRelPath(workflowName: string): string {
  const trimmed = workflowName.trim()
  return `${SIDECAR_DIR_NAME}/${PLANETZ_WORKFLOWS_DIRNAME}/${trimmed}.yaml`
}

export function orbitRuntimeWorkflowRelPath(workflowName: string): string {
  const trimmed = workflowName.trim()
  return `${SIDECAR_DIR_NAME}/${ORBIT_RUNTIME_WORKFLOWS_DIRNAME}/${trimmed}.yaml`
}

export function orbitWorkflowsDirRelPath(): string {
  return `${SIDECAR_DIR_NAME}/${PLANETZ_WORKFLOWS_DIRNAME}`
}

export function orbitRuntimeWorkflowsDirRelPath(): string {
  return `${SIDECAR_DIR_NAME}/${ORBIT_RUNTIME_WORKFLOWS_DIRNAME}`
}

export function orbitFacetsDirRelPath(): string {
  return `${SIDECAR_DIR_NAME}/${ORBIT_FACETS_DIRNAME}`
}

export function orbitWorkflowRoutingPath(workspacePath: string): string {
  return workspacePathJoin(workspacePath, SIDECAR_DIR_NAME, 'workflow-routing.yaml')
}
