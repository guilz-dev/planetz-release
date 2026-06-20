import { mkdir } from 'node:fs/promises'
import type { EngineConfig, UiConfig } from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { syncIsolatedRepoToMain } from './isolated-repo-sync.js'
import {
  assertIsolatedOutsideMain,
  isolatedRepoPath,
  isolatedTaktCompatWorktreesRoot,
  isolatedTaktWorktreesRoot,
} from './isolated-workspace-paths.js'
import { projectMainOrbitToIsolated } from './orbit-isolated-projection.js'
import { recordTaktPathAccess } from './takt-path-telemetry.js'

export interface IsolatedTaktWorkspace {
  mainWorkspacePath: string
  isolatedRepoPath: string
  lastBaseRef: string | null
}

/** Ensure clone/worktree parent dirs exist before bundled takt runs in the isolated repo. */
export async function ensureIsolatedTaktWorktreesRoot(isolatedRepoPath: string): Promise<void> {
  await mkdir(isolatedTaktWorktreesRoot(isolatedRepoPath), { recursive: true })
  await mkdir(isolatedTaktCompatWorktreesRoot(isolatedRepoPath), { recursive: true })
}

export async function ensureIsolatedTaktWorkspace(
  mainWorkspacePath: string,
): Promise<IsolatedTaktWorkspace> {
  const repo = isolatedRepoPath(mainWorkspacePath)
  assertIsolatedOutsideMain(mainWorkspacePath, repo)
  recordTaktPathAccess('orbit_takt_global', repo, 'ensureIsolatedTaktWorkspace')
  await mkdir(repo, { recursive: true }).catch(() => undefined)
  const { baseRef } = await syncIsolatedRepoToMain(mainWorkspacePath, repo)
  return { mainWorkspacePath, isolatedRepoPath: repo, lastBaseRef: baseRef }
}

export async function prepareIsolatedTaktExecution(
  ctx: IsolatedTaktWorkspace,
  mainSidecar: SidecarPaths,
  engine: EngineConfig,
  config: UiConfig,
): Promise<SidecarPaths> {
  const { baseRef } = await syncIsolatedRepoToMain(ctx.mainWorkspacePath, ctx.isolatedRepoPath)
  ctx.lastBaseRef = baseRef
  await ensureIsolatedTaktWorktreesRoot(ctx.isolatedRepoPath)
  return projectMainOrbitToIsolated(
    mainSidecar,
    ctx.mainWorkspacePath,
    ctx.isolatedRepoPath,
    engine,
    config,
  )
}
