import { createHash } from 'node:crypto'
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { orbitDraftsPath, orbitRootPath, readPlanetzEnv } from '@planetz/shared'

const LEGACY_DRAFT_MIGRATION_MARKER = '.drafts-migrated-from-home-takt'

function draftRootForWorkspace(workspacePath: string): string {
  const override = readPlanetzEnv('DRAFT_ROOT')
  if (override) return join(override, workspaceKey(workspacePath))
  return orbitDraftsPath(workspacePath)
}

function legacyHomeDraftDir(workspacePath: string): string {
  return join(homedir(), '.takt', '.cache', 'planetz-drafts', workspaceKey(workspacePath))
}

function workspaceKey(workspacePath: string): string {
  return createHash('sha256').update(workspacePath).digest('hex').slice(0, 16)
}

function draftPath(workspacePath: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48) || 'workflow'
  const nameHash = createHash('sha256').update(name).digest('hex').slice(0, 12)
  return join(draftRootForWorkspace(workspacePath), `${safe}--${nameHash}.yaml`)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** One-shot rescue from `~/.takt/.cache/planetz-drafts` to workspace `.planetz/orbit/.cache/planetz-drafts`. */
export async function rescueLegacyHomeDraftsIfNeeded(workspacePath: string): Promise<void> {
  const marker = join(orbitRootPath(workspacePath), LEGACY_DRAFT_MIGRATION_MARKER)
  if (await pathExists(marker)) return

  const legacyDir = legacyHomeDraftDir(workspacePath)
  const targetDir = draftRootForWorkspace(workspacePath)
  if (!(await pathExists(legacyDir))) {
    await mkdir(join(orbitRootPath(workspacePath), '.cache'), { recursive: true }).catch(
      () => undefined,
    )
    await writeFile(marker, 'no-legacy\n', 'utf8')
    return
  }

  await mkdir(targetDir, { recursive: true })
  let files: string[]
  try {
    files = await readdir(legacyDir)
  } catch {
    await writeFile(marker, 'empty-legacy\n', 'utf8')
    return
  }
  for (const file of files) {
    const src = join(legacyDir, file)
    const dest = join(targetDir, file)
    if (!(await pathExists(dest))) {
      await cp(src, dest)
    }
  }
  await writeFile(marker, `${legacyDir}\n`, 'utf8')
}

export async function saveWorkflowDraft(
  workspacePath: string,
  name: string,
  yaml: string,
): Promise<void> {
  await rescueLegacyHomeDraftsIfNeeded(workspacePath)
  const dir = draftRootForWorkspace(workspacePath)
  await mkdir(dir, { recursive: true })
  await writeFile(draftPath(workspacePath, name), yaml, 'utf8')
}

export async function loadWorkflowDraft(
  workspacePath: string,
  name: string,
): Promise<string | null> {
  await rescueLegacyHomeDraftsIfNeeded(workspacePath)
  try {
    return await readFile(draftPath(workspacePath, name), 'utf8')
  } catch {
    return null
  }
}

export async function deleteWorkflowDraft(workspacePath: string, name: string): Promise<void> {
  try {
    await rm(draftPath(workspacePath, name), { force: true })
  } catch {
    // ignore missing draft
  }
}

export async function listWorkflowDraftNames(workspacePath: string): Promise<string[]> {
  await rescueLegacyHomeDraftsIfNeeded(workspacePath)
  const dir = draftRootForWorkspace(workspacePath)
  try {
    const files = await readdir(dir)
    return files.filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''))
  } catch {
    return []
  }
}
