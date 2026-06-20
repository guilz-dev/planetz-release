import { type Dirent, existsSync } from 'node:fs'
import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import type { FacetKind, ProjectFacetSummary, UiConfig } from '@planetz/shared'
import {
  facetKindToFolder,
  facetManagedPath,
  facetRelPath,
  orbitFacetsPath,
  orbitImportSnapshotFacetsPath,
  orbitTaktGlobalPath,
  SIDECAR_DIR_NAME,
  slugifyFacetKey,
} from '@planetz/shared'
import { candidateBundledTaktRoots } from './exec-cli.js'

export type FacetFileSource = 'project' | 'user' | 'builtin' | 'missing'

export interface FacetReadResult {
  managedPath: string
  source: FacetFileSource
  content: string | null
}

const DEFAULT_BUILTIN_LANGUAGES = ['en', 'ja'] as const
const BUILTIN_FACET_FOLDERS = {
  personas: 'personas',
  policies: 'policies',
  knowledge: 'knowledge',
  instructions: 'instructions',
  reportFormats: 'output-contracts',
} as const

export interface BuiltinFacetCatalog {
  personas: string[]
  policies: string[]
  knowledge: string[]
  instructions: string[]
  reportFormats: string[]
}

export { facetKindToFolder, facetRelPath, slugifyFacetKey }

export function facetManagedPathFromKindKey(kind: FacetKind, key: string): string {
  return facetManagedPath(kind, key)
}

function _resolveProjectFacetAbsPath(
  workspacePath: string,
  config: UiConfig,
  kind: FacetKind,
  key: string,
  options?: { facetsRoot?: string },
): string | null {
  const facetRel = facetRelPath(kind, key)
  const facetsRoot = normalize(
    resolve(options?.facetsRoot ?? join(workspacePath, config.facetsDir)),
  )
  const resolvedFacetPath = normalize(resolve(facetsRoot, facetRel))
  return isPathInside(facetsRoot, resolvedFacetPath) ? resolvedFacetPath : null
}

function resolveCanonicalFacetAbsPath(
  mainWorkspacePath: string,
  kind: FacetKind,
  key: string,
): string | null {
  const facetRel = facetRelPath(kind, key)
  const facetsRoot = normalize(resolve(orbitFacetsPath(mainWorkspacePath)))
  const resolvedFacetPath = normalize(resolve(facetsRoot, facetRel))
  return isPathInside(facetsRoot, resolvedFacetPath) ? resolvedFacetPath : null
}

function sanitizeFacetRelPath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized.endsWith('.md')) return null
  const segments = normalized.split('/')
  if (segments.length < 2) return null
  if (segments.some((seg) => seg.length === 0 || seg === '.' || seg === '..')) return null
  return segments.join('/')
}

function isPathInside(baseDir: string, targetPath: string): boolean {
  const rel = relative(baseDir, targetPath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Relative path under `.takt/facets/` from a workflow-managed path. */
export function managedPathToFacetRel(managedPath: string): string | null {
  const normalized = managedPath.trim().replace(/\\/g, '/')
  const withFacets = normalized.match(/^(?:\.\.\/)?facets\/(.+)$/i)
  if (withFacets) return sanitizeFacetRelPath(withFacets[1])
  if (/^[a-z0-9./_-]+\.md$/i.test(normalized)) return sanitizeFacetRelPath(normalized)
  return null
}

function bundledFacetAbsPath(language: string, facetRel: string): string | null {
  for (const root of candidateBundledTaktRoots()) {
    const path = join(root, 'builtins', language, 'facets', facetRel)
    if (existsSync(path)) return path
  }
  return null
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function resolveProjectFacetPath(
  workspacePath: string,
  config: UiConfig,
  managedPath: string,
): string | null {
  const facetRel = managedPathToFacetRel(managedPath)
  if (facetRel) {
    const facetsRoot = normalize(resolve(workspacePath, config.facetsDir))
    const resolvedFacetPath = normalize(resolve(facetsRoot, facetRel))
    return isPathInside(facetsRoot, resolvedFacetPath) ? resolvedFacetPath : null
  }
  const norm = managedPath.trim().replace(/\\/g, '/')
  const workflowsDir = join(workspacePath, config.workflowsDir)
  const resolved = normalize(resolve(workflowsDir, norm))
  const workspaceRoot = normalize(resolve(workspacePath))
  if (!isPathInside(workspaceRoot, resolved)) return null
  return resolved
}

export async function readFacetAtManagedPath(
  workspacePath: string,
  config: UiConfig,
  managedPath: string,
  options?: { languages?: readonly string[]; mainWorkspacePath?: string },
): Promise<FacetReadResult> {
  const trimmed = managedPath.trim()
  if (!trimmed) {
    return { managedPath, source: 'missing', content: null }
  }

  const mainWs = options?.mainWorkspacePath ?? workspacePath
  const facetRel = managedPathToFacetRel(trimmed)
  if (facetRel) {
    const canonicalPath = join(orbitFacetsPath(mainWs), facetRel)
    if (await pathExists(canonicalPath)) {
      const content = await readFile(canonicalPath, 'utf8')
      return { managedPath: trimmed, source: 'project', content }
    }
  }

  const projectPath = resolveProjectFacetPath(workspacePath, config, trimmed)
  if (projectPath && (await pathExists(projectPath))) {
    const content = await readFile(projectPath, 'utf8')
    return { managedPath: trimmed, source: 'project', content }
  }

  if (facetRel) {
    const snapshotFacetPath = join(orbitImportSnapshotFacetsPath(mainWs), facetRel)
    if (await pathExists(snapshotFacetPath)) {
      const content = await readFile(snapshotFacetPath, 'utf8')
      return { managedPath: trimmed, source: 'user', content }
    }

    const legacyGlobalFacetPath = join(orbitTaktGlobalPath(mainWs), 'facets', facetRel)
    if (await pathExists(legacyGlobalFacetPath)) {
      const content = await readFile(legacyGlobalFacetPath, 'utf8')
      return { managedPath: trimmed, source: 'user', content }
    }

    const languages = options?.languages ?? DEFAULT_BUILTIN_LANGUAGES
    for (const lang of languages) {
      const builtinPath = bundledFacetAbsPath(lang, facetRel)
      if (builtinPath) {
        const content = await readFile(builtinPath, 'utf8')
        return { managedPath: trimmed, source: 'builtin', content }
      }
    }
  }

  return { managedPath: trimmed, source: 'missing', content: null }
}

export async function readFacetsAtManagedPaths(
  workspacePath: string,
  config: UiConfig,
  managedPaths: string[],
  options?: { mainWorkspacePath?: string; languages?: readonly string[] },
): Promise<FacetReadResult[]> {
  const unique = [...new Set(managedPaths.map((p) => p.trim()).filter(Boolean))]
  return Promise.all(
    unique.map((managedPath) =>
      readFacetAtManagedPath(workspacePath, config, managedPath, options),
    ),
  )
}

export async function listBuiltinFacetCatalog(options?: {
  languages?: readonly string[]
}): Promise<BuiltinFacetCatalog> {
  const languages = options?.languages ?? DEFAULT_BUILTIN_LANGUAGES
  const sets: Record<keyof BuiltinFacetCatalog, Set<string>> = {
    personas: new Set(),
    policies: new Set(),
    knowledge: new Set(),
    instructions: new Set(),
    reportFormats: new Set(),
  }

  for (const root of candidateBundledTaktRoots()) {
    for (const lang of languages) {
      for (const [kind, folder] of Object.entries(BUILTIN_FACET_FOLDERS) as Array<
        [keyof BuiltinFacetCatalog, string]
      >) {
        const dir = join(root, 'builtins', lang, 'facets', folder)
        let entries: Dirent[]
        try {
          entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' })
        } catch {
          continue
        }
        for (const entry of entries) {
          if (!entry.isFile()) continue
          if (!entry.name.endsWith('.md')) continue
          const key = basename(entry.name, '.md')
          if (!key || key.startsWith('_')) continue
          sets[kind].add(key)
        }
      }
    }
  }

  return {
    personas: [...sets.personas].sort(),
    policies: [...sets.policies].sort(),
    knowledge: [...sets.knowledge].sort(),
    instructions: [...sets.instructions].sort(),
    reportFormats: [...sets.reportFormats].sort(),
  }
}

export async function listProjectFacets(
  mainWorkspacePath: string,
  _config: UiConfig,
): Promise<ProjectFacetSummary[]> {
  const facetsRoot = normalize(resolve(orbitFacetsPath(mainWorkspacePath)))
  const out: ProjectFacetSummary[] = []

  for (const kind of Object.keys(BUILTIN_FACET_FOLDERS) as Array<keyof BuiltinFacetCatalog>) {
    const folder = BUILTIN_FACET_FOLDERS[kind]
    const dir = join(facetsRoot, folder)
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.md')) continue
      const key = basename(entry.name, '.md')
      if (!key || key.startsWith('_')) continue
      out.push({
        kind,
        key,
        managedPath: facetManagedPathFromKindKey(kind, key),
      })
    }
  }

  return out.sort((a, b) => {
    const kindCmp = a.kind.localeCompare(b.kind)
    if (kindCmp !== 0) return kindCmp
    return a.key.localeCompare(b.key)
  })
}

export async function readFacetByKindKey(
  workspacePath: string,
  config: UiConfig,
  kind: FacetKind,
  key: string,
  preferredSource?: 'project' | 'builtin' | 'user',
  _options?: { taktRepoPath?: string },
): Promise<{
  kind: FacetKind
  key: string
  source: FacetFileSource
  content: string | null
  managedPath: string
}> {
  const managedPath = facetManagedPathFromKindKey(kind, key)
  if (preferredSource === 'project') {
    const projectPath = resolveCanonicalFacetAbsPath(workspacePath, kind, key)
    if (projectPath && (await pathExists(projectPath))) {
      const content = await readFile(projectPath, 'utf8')
      return { kind, key, source: 'project', content, managedPath }
    }
    return { kind, key, source: 'missing', content: null, managedPath }
  }
  if (preferredSource === 'user') {
    const facetRel = facetRelPath(kind, key)
    const snapshotFacetPath = join(orbitImportSnapshotFacetsPath(workspacePath), facetRel)
    if (await pathExists(snapshotFacetPath)) {
      const content = await readFile(snapshotFacetPath, 'utf8')
      return { kind, key, source: 'user', content, managedPath }
    }
    const legacyGlobalFacetPath = join(orbitTaktGlobalPath(workspacePath), 'facets', facetRel)
    if (await pathExists(legacyGlobalFacetPath)) {
      const content = await readFile(legacyGlobalFacetPath, 'utf8')
      return { kind, key, source: 'user', content, managedPath }
    }
    return { kind, key, source: 'missing', content: null, managedPath }
  }
  if (preferredSource === 'builtin') {
    const facetRel = facetRelPath(kind, key)
    for (const lang of DEFAULT_BUILTIN_LANGUAGES) {
      const builtinPath = bundledFacetAbsPath(lang, facetRel)
      if (builtinPath) {
        const content = await readFile(builtinPath, 'utf8')
        return { kind, key, source: 'builtin', content, managedPath }
      }
    }
    return { kind, key, source: 'missing', content: null, managedPath }
  }

  const result = await readFacetAtManagedPath(workspacePath, config, managedPath, {
    mainWorkspacePath: workspacePath,
  })
  return {
    kind,
    key,
    source: result.source,
    content: result.content,
    managedPath,
  }
}

const WORKFLOW_FACET_PATH_PATTERN = /\.\.\/facets\/[a-zA-Z0-9./_-]+\.md/g

export interface MaterializeWorkflowFacetsOptions {
  /** Optional project facet tree to copy from before falling back to bundled orbit. */
  fallbackFacetsRoot?: string
}

export function listFacetRefsFromWorkflowYaml(yaml: string): string[] {
  return [...new Set(yaml.match(WORKFLOW_FACET_PATH_PATTERN) ?? [])]
}

async function countMissingFacetFiles(facetsRoot: string, managedPaths: string[]): Promise<number> {
  let missing = 0
  for (const managedPath of managedPaths) {
    const facetRel = managedPathToFacetRel(managedPath)
    if (!facetRel) continue
    const destPath = join(facetsRoot, facetRel)
    if (!(await pathExists(destPath))) missing += 1
  }
  return missing
}

/**
 * Materialize facets referenced by every workflow YAML under `workflowsDir`.
 * Precedence per ref: existing file in `facetsRoot` → `fallbackFacetsRoot` → bundled orbit.
 */
export async function ensureCanonicalDirWorkflowFacetsMaterialized(
  facetsRoot: string,
  workflowsDir: string,
  options?: MaterializeWorkflowFacetsOptions,
): Promise<{ workflowFiles: number; facetRefs: number; facetsMaterialized: number }> {
  let entries: string[]
  try {
    entries = await readdir(workflowsDir)
  } catch {
    return { workflowFiles: 0, facetRefs: 0, facetsMaterialized: 0 }
  }

  const workflowFiles = entries.filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
  const yamlTexts: string[] = []
  const facetRefSet = new Set<string>()

  for (const file of workflowFiles) {
    const yaml = await readFile(join(workflowsDir, file), 'utf8')
    yamlTexts.push(yaml)
    for (const ref of listFacetRefsFromWorkflowYaml(yaml)) {
      facetRefSet.add(ref)
    }
  }

  const facetRefs = [...facetRefSet]
  const missingBefore = await countMissingFacetFiles(facetsRoot, facetRefs)
  for (const yaml of yamlTexts) {
    await materializeMissingFacetsForWorkflowYaml(facetsRoot, yaml, options)
  }
  const missingAfter = await countMissingFacetFiles(facetsRoot, facetRefs)

  return {
    workflowFiles: workflowFiles.length,
    facetRefs: facetRefs.length,
    facetsMaterialized: Math.max(0, missingBefore - missingAfter),
  }
}

/**
 * Copy one facet file into `facetsRoot` when absent.
 * Order: skip if dest exists → `fallbackFacetsRoot` → bundled orbit (`en` then `ja`).
 */
async function materializeMissingFacetIfBundled(
  facetsRoot: string,
  managedPath: string,
  options?: MaterializeWorkflowFacetsOptions,
): Promise<void> {
  const facetRel = managedPathToFacetRel(managedPath)
  if (!facetRel) return

  const dest = join(facetsRoot, facetRel)
  if (await pathExists(dest)) return

  const fallbackRoot = options?.fallbackFacetsRoot
  if (fallbackRoot) {
    const fallbackSrc = join(fallbackRoot, facetRel)
    if (await pathExists(fallbackSrc)) {
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(fallbackSrc, dest)
      return
    }
  }

  for (const lang of DEFAULT_BUILTIN_LANGUAGES) {
    const src = bundledFacetAbsPath(lang, facetRel)
    if (!src) continue
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
    return
  }
}

/** Copy facet files referenced by workflow YAML into a target facets root when missing. */
export async function materializeMissingFacetsForWorkflowYaml(
  facetsRoot: string,
  yaml: string,
  options?: MaterializeWorkflowFacetsOptions,
): Promise<void> {
  for (const managedPath of listFacetRefsFromWorkflowYaml(yaml)) {
    await materializeMissingFacetIfBundled(facetsRoot, managedPath, options)
  }
}

export async function writeProjectFacet(
  mainWorkspacePath: string,
  _config: UiConfig,
  kind: FacetKind,
  key: string,
  content: string,
): Promise<{ path: string }> {
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    throw new Error('facet key is empty')
  }
  const absPath = resolveCanonicalFacetAbsPath(mainWorkspacePath, kind, trimmedKey)
  if (!absPath) {
    throw new Error(`invalid facet path for ${kind}/${trimmedKey}`)
  }
  await mkdir(dirname(absPath), { recursive: true })
  await writeFile(absPath, content, 'utf8')
  const rel = join(SIDECAR_DIR_NAME, 'facets', facetRelPath(kind, trimmedKey)).replace(/\\/g, '/')
  return { path: rel }
}

export async function deleteProjectFacet(
  mainWorkspacePath: string,
  _config: UiConfig,
  kind: FacetKind,
  key: string,
): Promise<void> {
  const trimmedKey = key.trim()
  if (!trimmedKey) {
    throw new Error('facet key is empty')
  }
  const absPath = resolveCanonicalFacetAbsPath(mainWorkspacePath, kind, trimmedKey)
  if (!absPath) {
    throw new Error(`invalid facet path for ${kind}/${trimmedKey}`)
  }
  if (!(await pathExists(absPath))) {
    throw new Error(`project facet not found: ${kind}/${trimmedKey}`)
  }
  await rm(absPath)
}
