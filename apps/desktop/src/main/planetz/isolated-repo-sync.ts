import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
  PLANETZ_SIDECAR_PARENT_DIR_NAME,
} from '@planetz/shared'
import { execa } from 'execa'

/** Never copy Planetz sidecar tree into isolated repo (SSOT remains on main). */
const SIDECAR_DIR_SKIP = new Set([
  PLANETZ_SIDECAR_PARENT_DIR_NAME,
  LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME,
])
const WORKSPACE_MARKER_FILE = '.planetz-main-workspace-path'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  )
}

async function isGitRepo(dir: string): Promise<boolean> {
  return pathExists(join(dir, '.git'))
}

async function readGitHead(repoPath: string): Promise<string | null> {
  if (!(await isGitRepo(repoPath))) return null
  const result = await execa('git', ['-C', repoPath, 'rev-parse', 'HEAD'], {
    reject: false,
  })
  if (result.exitCode !== 0) return null
  const ref = result.stdout.trim()
  return ref.length > 0 ? ref : null
}

async function readMainHead(mainWorkspacePath: string): Promise<string | null> {
  return readGitHead(mainWorkspacePath)
}

async function readMainSymbolicBranch(mainWorkspacePath: string): Promise<string | null> {
  if (!(await isGitRepo(mainWorkspacePath))) return null
  const result = await execa('git', ['-C', mainWorkspacePath, 'symbolic-ref', '--short', 'HEAD'], {
    reject: false,
  })
  if (result.exitCode !== 0) return null
  const name = result.stdout.trim()
  return name.length > 0 ? name : null
}

async function readOriginUrl(repoPath: string): Promise<string | null> {
  if (!(await isGitRepo(repoPath))) return null
  const result = await execa('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], {
    reject: false,
  })
  if (result.exitCode !== 0) return null
  const url = result.stdout.trim()
  return url.length > 0 ? url : null
}

async function alignIsolatedOriginToMain(
  mainWorkspacePath: string,
  isolatedRepo: string,
): Promise<void> {
  const mainOrigin = await readOriginUrl(mainWorkspacePath)
  if (!mainOrigin) return

  const isolatedOrigin = await readOriginUrl(isolatedRepo)
  if (isolatedOrigin === mainOrigin) return

  const remoteArgs = isolatedOrigin
    ? ['set-url', 'origin', mainOrigin]
    : ['add', 'origin', mainOrigin]
  const result = await execa('git', ['-C', isolatedRepo, 'remote', ...remoteArgs], {
    reject: false,
  })
  if (result.exitCode === 0) return
  console.warn('[planetz] failed to align isolated repo origin', {
    isolatedRepo,
    mainOrigin,
    isolatedOrigin,
    stderr: result.stderr?.trim(),
  })
}

async function readOriginDefaultBranch(isolatedRepo: string): Promise<string | null> {
  const result = await execa(
    'git',
    ['-C', isolatedRepo, 'symbolic-ref', 'refs/remotes/origin/HEAD'],
    { reject: false },
  )
  if (result.exitCode !== 0) return null
  const ref = result.stdout.trim()
  const prefix = 'refs/remotes/origin/'
  if (!ref.startsWith(prefix)) return null
  const branch = ref.slice(prefix.length).trim()
  return branch.length > 0 ? branch : null
}

async function readAbbrevRef(repo: string): Promise<string | null> {
  const result = await execa('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD'], {
    reject: false,
  })
  if (result.exitCode !== 0) return null
  const abbrev = result.stdout.trim()
  return abbrev.length > 0 ? abbrev : null
}

async function resolveSyncBranchName(
  mainWorkspacePath: string,
  isolatedRepo: string,
): Promise<string | null> {
  return (
    (await readMainSymbolicBranch(mainWorkspacePath)) ??
    (await readOriginDefaultBranch(isolatedRepo))
  )
}

async function checkoutIsolatedToNamedBranch(
  isolatedRepo: string,
  baseRef: string,
  branchName: string,
): Promise<boolean> {
  const result = await execa('git', ['-C', isolatedRepo, 'checkout', '-B', branchName, baseRef], {
    reject: false,
  })
  if (result.exitCode === 0) return true
  console.warn('[planetz] isolated repo branch checkout failed', {
    branchName,
    baseRef,
    stderr: result.stderr?.trim(),
  })
  return false
}

async function checkoutIsolatedDetached(isolatedRepo: string, baseRef: string): Promise<void> {
  await execa('git', ['-C', isolatedRepo, 'checkout', '--detach', baseRef], { reject: false })
}

async function alignIsolatedCheckout(
  mainWorkspacePath: string,
  isolatedRepo: string,
  baseRef: string,
): Promise<void> {
  const branchName = await resolveSyncBranchName(mainWorkspacePath, isolatedRepo)
  if (branchName && (await checkoutIsolatedToNamedBranch(isolatedRepo, baseRef, branchName))) {
    return
  }
  console.warn('[planetz] isolated repo falling back to detached checkout', {
    branchName,
    baseRef,
  })
  await checkoutIsolatedDetached(isolatedRepo, baseRef)
}

async function copyTreeFiltered(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  let entries: string[]
  try {
    entries = await readdir(src)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === '.git' || name === 'node_modules' || SIDECAR_DIR_SKIP.has(name)) continue
    const from = join(src, name)
    const to = join(dest, name)
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(from)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      await copyTreeFiltered(from, to)
    } else if (info.isFile()) {
      try {
        await cp(from, to)
      } catch (error: unknown) {
        // Source may disappear between stat and copy (race); other errors must surface.
        if (isErrno(error, 'ENOENT')) continue
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to copy ${from} to ${to}: ${message}`, { cause: error })
      }
    }
  }
}

async function resetIsolatedRepoDirectory(isolatedRepo: string): Promise<void> {
  await mkdir(isolatedRepo, { recursive: true })
  let entries: string[]
  try {
    entries = await readdir(isolatedRepo)
  } catch {
    return
  }
  for (const entry of entries) {
    await rm(join(isolatedRepo, entry), { recursive: true, force: true })
  }
}

async function readWorkspaceMarker(isolatedRepo: string): Promise<string | null> {
  try {
    return (await readFile(join(isolatedRepo, WORKSPACE_MARKER_FILE), 'utf8')).trim() || null
  } catch {
    return null
  }
}

async function isolatedRepoMatchesMainWorkspace(
  mainWorkspacePath: string,
  isolatedRepo: string,
): Promise<boolean> {
  const expected = resolve(mainWorkspacePath)
  const marker = await readWorkspaceMarker(isolatedRepo)
  return marker === expected
}

async function hasSeededIsolatedContent(isolatedRepo: string): Promise<boolean> {
  try {
    const entries = await readdir(isolatedRepo)
    return entries.some((entry) => entry !== WORKSPACE_MARKER_FILE)
  } catch {
    return false
  }
}

async function writeWorkspaceMarker(
  isolatedRepo: string,
  mainWorkspacePath: string,
): Promise<void> {
  await writeFile(
    join(isolatedRepo, WORKSPACE_MARKER_FILE),
    `${resolve(mainWorkspacePath)}\n`,
    'utf8',
  )
}

async function ensureWorkspaceMarker(
  isolatedRepo: string,
  mainWorkspacePath: string,
): Promise<void> {
  const expected = resolve(mainWorkspacePath)
  const current = await readWorkspaceMarker(isolatedRepo)
  if (current && current !== expected) {
    await resetIsolatedRepoDirectory(isolatedRepo)
  }
  await writeWorkspaceMarker(isolatedRepo, expected)
}

/**
 * Seed a non-git main workspace into the isolated repo (no sidecar copy — SSOT stays on main).
 */
async function seedNonGitMain(mainWorkspacePath: string, isolatedRepo: string): Promise<void> {
  await resetIsolatedRepoDirectory(isolatedRepo)
  await copyTreeFiltered(mainWorkspacePath, isolatedRepo)
  await writeWorkspaceMarker(isolatedRepo, mainWorkspacePath)
}

/**
 * Skip destructive resync when isolated repo already matches main HEAD.
 * Preserves uncommitted `.takt/` task state across app restarts (in-memory `lastSyncedBaseRef` is lost).
 */
async function tryReuseSyncedIsolatedRepo(
  mainWorkspacePath: string,
  isolatedRepo: string,
  baseRef: string,
): Promise<{ baseRef: string } | null> {
  if (!(await pathExists(isolatedRepo)) || !(await isGitRepo(isolatedRepo))) {
    return null
  }
  if (!(await isolatedRepoMatchesMainWorkspace(mainWorkspacePath, isolatedRepo))) {
    return null
  }

  const isolatedHead = await readGitHead(isolatedRepo)
  if (isolatedHead !== baseRef) return null

  const abbrev = await readAbbrevRef(isolatedRepo)
  if (abbrev && abbrev !== 'HEAD') {
    return { baseRef }
  }
  if (abbrev === 'HEAD') {
    await alignIsolatedCheckout(mainWorkspacePath, isolatedRepo, baseRef)
    const realigned = await readAbbrevRef(isolatedRepo)
    if (realigned && realigned !== 'HEAD') {
      await writeWorkspaceMarker(isolatedRepo, mainWorkspacePath)
      return { baseRef }
    }
  }
  return null
}

async function tryReuseSeededNonGitIsolatedRepo(
  mainWorkspacePath: string,
  isolatedRepo: string,
  hadWorkspaceMarkerBeforeSync: boolean,
): Promise<{ baseRef: null } | null> {
  if (!hadWorkspaceMarkerBeforeSync) return null
  if (!(await pathExists(isolatedRepo))) return null
  if (!(await isolatedRepoMatchesMainWorkspace(mainWorkspacePath, isolatedRepo))) {
    return null
  }
  if (!(await hasSeededIsolatedContent(isolatedRepo))) return null
  return { baseRef: null }
}

/**
 * Align isolated repo to `main` HEAD. Uses clone + hard reset; does not push or merge to main.
 */
export async function syncIsolatedRepoToMain(
  mainWorkspacePath: string,
  isolatedRepo: string,
): Promise<{ baseRef: string | null }> {
  await mkdir(isolatedRepo, { recursive: true })
  const hadWorkspaceMarkerBeforeSync = (await readWorkspaceMarker(isolatedRepo)) !== null
  await ensureWorkspaceMarker(isolatedRepo, mainWorkspacePath)

  const baseRef = await readMainHead(mainWorkspacePath)
  if (baseRef) {
    const reused = await tryReuseSyncedIsolatedRepo(mainWorkspacePath, isolatedRepo, baseRef)
    if (reused) {
      await alignIsolatedOriginToMain(mainWorkspacePath, isolatedRepo)
      return reused
    }
  }
  if (!baseRef) {
    const reused = await tryReuseSeededNonGitIsolatedRepo(
      mainWorkspacePath,
      isolatedRepo,
      hadWorkspaceMarkerBeforeSync,
    )
    if (reused) return reused
    await seedNonGitMain(mainWorkspacePath, isolatedRepo)
    return { baseRef: null }
  }

  if (!(await isGitRepo(isolatedRepo))) {
    await mkdir(resolve(isolatedRepo, '..'), { recursive: true })
    await resetIsolatedRepoDirectory(isolatedRepo)
    const cloneResult = await execa('git', ['clone', mainWorkspacePath, isolatedRepo], {
      reject: false,
    })
    if (cloneResult.exitCode !== 0 || !(await isGitRepo(isolatedRepo))) {
      await seedNonGitMain(mainWorkspacePath, isolatedRepo)
      return { baseRef }
    }
    await writeWorkspaceMarker(isolatedRepo, mainWorkspacePath)
  }

  await alignIsolatedOriginToMain(mainWorkspacePath, isolatedRepo)
  await execa('git', ['-C', isolatedRepo, 'fetch', '--all', '--prune'], { reject: false })
  await execa('git', ['-C', isolatedRepo, 'reset', '--hard', baseRef], { reject: false })
  await execa('git', ['-C', isolatedRepo, 'clean', '-fd'], { reject: false })
  await alignIsolatedCheckout(mainWorkspacePath, isolatedRepo, baseRef)
  await writeWorkspaceMarker(isolatedRepo, mainWorkspacePath)

  return { baseRef }
}
