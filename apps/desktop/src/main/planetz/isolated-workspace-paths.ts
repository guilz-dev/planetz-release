import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { app } from 'electron'

export function getPlanetzDataRoot(): string {
  return resolve(app.getPath('userData'), 'planetz')
}

export function hashMainWorkspacePath(mainWorkspacePath: string): string {
  return createHash('sha256').update(resolve(mainWorkspacePath)).digest('hex').slice(0, 16)
}

export function isolatedRepoPath(mainWorkspacePath: string): string {
  const hash = hashMainWorkspacePath(mainWorkspacePath)
  return resolve(getPlanetzDataRoot(), 'isolated', hash, 'repo')
}

/** Default shared-clone parent for bundled takt (`../takt-worktrees` from isolated repo). */
export function isolatedTaktWorktreesRoot(isolatedRepoPath: string): string {
  return resolve(dirname(isolatedRepoPath), 'takt-worktrees')
}

/** Fallback clone root when the default parent is not writable. */
export function isolatedTaktCompatWorktreesRoot(isolatedRepoPath: string): string {
  return resolve(join(isolatedRepoPath, DEFAULT_CONFIG.taktDir, 'worktrees'))
}

/** Isolated repo must live outside the main workspace tree. */
export function assertIsolatedOutsideMain(mainWorkspacePath: string, isolatedPath: string): void {
  const main = resolve(mainWorkspacePath)
  const isolated = resolve(isolatedPath)
  if (main === isolated) {
    throw new Error('isolated repo path must not equal main workspace path')
  }
  const mainPrefix = main.endsWith('/') ? main : `${main}/`
  if (isolated.startsWith(mainPrefix)) {
    throw new Error('isolated repo must not be located under the main workspace directory')
  }
}
