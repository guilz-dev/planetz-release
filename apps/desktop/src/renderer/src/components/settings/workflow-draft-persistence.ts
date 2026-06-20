import { facetManagedPath } from './facets/facet-path.js'
import { FACET_KINDS, type WorkflowDraft } from './workflow-draft-types.js'
import {
  collectDraftFacetContentByPath,
  collectFacetManagedPaths,
  hydrateWorkflowDraftFacets,
} from './workflow-facet-draft-adapter.js'

export const WORKFLOW_DRAFT_STORAGE_PREFIX = 'planetz:workflow-draft:'
export const WORKFLOW_DRAFT_FACET_STORAGE_PREFIX = 'planetz:workflow-facet-draft:'

export function workflowDraftFacetStorageKey(name: string): string {
  return `${WORKFLOW_DRAFT_FACET_STORAGE_PREFIX}${name}`
}

export function parseWorkflowFacetDraftSnapshot(raw: string | null): Record<string, string> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [managedPath, content] of Object.entries(parsed)) {
      if (managedPath.trim().length === 0) continue
      if (typeof content !== 'string') continue
      out[managedPath] = content
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

/** Project-relative facet paths and bodies for `writeProjectWorkflow`. */
export function collectWorkflowFacetFilesForSave(
  draft: WorkflowDraft,
): Record<string, string> | undefined {
  const facetFiles: Record<string, string> = {}
  for (const kind of FACET_KINDS) {
    for (const item of draft[kind]) {
      const key = item.key.trim()
      const content = (item.content ?? '').trim()
      if (!key || !content) continue
      const managed = facetManagedPath(kind, key)
      const projectRelative = managed.replace(/^\.\.\//, '')
      facetFiles[projectRelative] = `${content}\n`
    }
  }
  return Object.keys(facetFiles).length > 0 ? facetFiles : undefined
}

export async function loadWorkflowDraftWithFacets(parsed: WorkflowDraft): Promise<WorkflowDraft> {
  const paths = collectFacetManagedPaths(parsed)
  if (paths.length === 0) return parsed
  try {
    const reads = await window.orbit.readWorkflowFacets({ managedPaths: paths })
    return hydrateWorkflowDraftFacets(parsed, reads)
  } catch {
    return parsed
  }
}

export async function persistWorkflowDraft(nextDraft: WorkflowDraft, yaml: string): Promise<void> {
  const name = nextDraft.name
  if (!name.trim() || !yaml.trim()) return
  const facetSnapshot = collectDraftFacetContentByPath(nextDraft)
  if (Object.keys(facetSnapshot).length > 0) {
    localStorage.setItem(workflowDraftFacetStorageKey(name), JSON.stringify(facetSnapshot))
  } else {
    localStorage.removeItem(workflowDraftFacetStorageKey(name))
  }
  try {
    await window.orbit.saveWorkflowDraft({ name, yaml })
    localStorage.removeItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}${name}`)
  } catch {
    localStorage.setItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}${name}`, yaml)
  }
}

export async function clearWorkflowDraft(name: string): Promise<void> {
  localStorage.removeItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}${name}`)
  localStorage.removeItem(workflowDraftFacetStorageKey(name))
  try {
    await window.orbit.deleteWorkflowDraft({ name })
  } catch {
    // ignore when workspace is not open
  }
}

export interface WorkflowDraftRestoreResult {
  yaml: string
  restoreDrafts: boolean
  facetDraftSnapshot: Record<string, string> | null
}

export interface WorkflowDraftRestoreOptions {
  /** When omitted, falls back to `window.confirm`. */
  confirmRestoreDraft?: (message: string) => Promise<boolean>
}

/** Resolve on-disk yaml vs local/disk draft; may prompt the user. */
export async function resolveWorkflowDraftOnOpen(
  name: string,
  diskYaml: string,
  options?: WorkflowDraftRestoreOptions,
): Promise<WorkflowDraftRestoreResult> {
  const confirmRestoreDraft =
    options?.confirmRestoreDraft ??
    ((message: string) =>
      Promise.resolve(
        typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : false,
      ))
  const { yaml: diskDraft } = await window.orbit.loadWorkflowDraft({ name })
  const legacyDraft = localStorage.getItem(`${WORKFLOW_DRAFT_STORAGE_PREFIX}${name}`)
  const facetDraftSnapshot = parseWorkflowFacetDraftSnapshot(
    localStorage.getItem(workflowDraftFacetStorageKey(name)),
  )
  const storedDraft = diskDraft ?? legacyDraft
  const hasYamlDraft = Boolean(storedDraft && storedDraft !== diskYaml)
  const hasFacetDraft = facetDraftSnapshot != null
  let yaml = diskYaml
  let restoreDrafts = false
  if (hasYamlDraft || hasFacetDraft) {
    const restore = await confirmRestoreDraft(
      `Unsaved draft for "${name}". Restore it?\n\nOK = load draft\nCancel = use file on disk`,
    )
    if (restore) {
      restoreDrafts = true
      if (hasYamlDraft && storedDraft) yaml = storedDraft
    } else {
      await clearWorkflowDraft(name)
    }
  }
  return { yaml, restoreDrafts, facetDraftSnapshot }
}
