import { access, copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { UiConfig } from '@planetz/shared'
import { orbitFacetsPath, orbitRootPath } from '@planetz/shared'

const MIGRATION_MARKER = '.orbit-facets-migrated-from-takt'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function dirHasMarkdownFiles(dir: string): Promise<boolean> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return false
  }
  for (const name of entries) {
    const path = join(dir, name)
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(path)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      if (await dirHasMarkdownFiles(path)) return true
    } else if (info.isFile() && name.endsWith('.md')) {
      return true
    }
  }
  return false
}

async function copyFileIfMissing(src: string, dest: string): Promise<void> {
  if (await exists(dest)) return
  await mkdir(dirname(dest), { recursive: true })
  await copyFile(src, dest)
}

async function copyFacetTree(srcRoot: string, destRoot: string): Promise<void> {
  await mkdir(destRoot, { recursive: true })
  let entries: string[]
  try {
    entries = await readdir(srcRoot)
  } catch {
    return
  }
  for (const name of entries) {
    const src = join(srcRoot, name)
    const dest = join(destRoot, name)
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(src)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      await copyFacetTree(src, dest)
    } else if (info.isFile() && name.endsWith('.md')) {
      await copyFileIfMissing(src, dest)
    }
  }
}

async function writeMigrationMarker(workspacePath: string): Promise<void> {
  const marker = join(orbitRootPath(workspacePath), MIGRATION_MARKER)
  await mkdir(dirname(marker), { recursive: true })
  await writeFile(marker, `${new Date().toISOString()}\n`, 'utf8')
}

/**
 * One-shot copy from main `<ws>/.takt/facets/` into `.planetz/orbit/facets/` when orbit has no facet files yet.
 */
export async function migrateLegacyMainTaktFacetsToOrbitIfNeeded(
  workspacePath: string,
  config: UiConfig,
): Promise<boolean> {
  const marker = join(orbitRootPath(workspacePath), MIGRATION_MARKER)
  if (await exists(marker)) return false

  const legacyRoot = join(workspacePath, config.facetsDir)
  const canonicalRoot = orbitFacetsPath(workspacePath)
  const [legacyHasFacets, orbitHasFacets] = await Promise.all([
    dirHasMarkdownFiles(legacyRoot),
    dirHasMarkdownFiles(canonicalRoot),
  ])

  if (!legacyHasFacets) return false
  if (orbitHasFacets) {
    await writeMigrationMarker(workspacePath)
    return false
  }

  await copyFacetTree(legacyRoot, canonicalRoot)
  await writeMigrationMarker(workspacePath)
  return true
}
