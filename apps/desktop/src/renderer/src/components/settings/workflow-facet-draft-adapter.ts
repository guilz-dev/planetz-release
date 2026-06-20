import { facetManagedPath } from './facets/facet-path.js'
import { FACET_KINDS, type FacetKind, type WorkflowDraft } from './workflow-draft-types.js'
import { getStepFacetRef, getStepOutputFormats } from './workflow-facet-utils.js'

/** All workflow-managed facet paths referenced by section maps and steps. */
export function collectFacetManagedPaths(draft: WorkflowDraft): string[] {
  const paths = new Set<string>()
  const projectKeysByKind: Record<FacetKind, Set<string>> = {
    personas: new Set(),
    policies: new Set(),
    knowledge: new Set(),
    instructions: new Set(),
    reportFormats: new Set(),
  }

  for (const kind of FACET_KINDS) {
    for (const m of draft[kind]) {
      if (m.path?.trim()) paths.add(m.path.trim())
      else if (m.key.trim()) paths.add(facetManagedPath(kind, m.key))
      if (m.key) projectKeysByKind[kind].add(m.key)
    }
    for (const step of draft.steps) {
      if (kind === 'reportFormats') {
        for (const fmt of getStepOutputFormats(step)) {
          if (!fmt || projectKeysByKind[kind].has(fmt)) continue
          paths.add(facetManagedPath(kind, fmt))
        }
      } else {
        const ref = getStepFacetRef(step, kind)
        if (!ref || projectKeysByKind[kind].has(ref)) continue
        paths.add(facetManagedPath(kind, ref))
      }
    }
  }

  return [...paths]
}

export function hydrateWorkflowDraftFacets(
  draft: WorkflowDraft,
  reads: Array<{ managedPath: string; content: string | null }>,
  options?: { overwriteExisting?: boolean },
): WorkflowDraft {
  const byPath: Record<string, string> = { ...(draft.facetContentByPath ?? {}) }
  for (const read of reads) {
    if (read.content != null) byPath[read.managedPath] = read.content
  }

  const overwriteExisting = options?.overwriteExisting ?? false
  const next: WorkflowDraft = { ...draft, facetContentByPath: byPath }
  for (const kind of FACET_KINDS) {
    next[kind] = draft[kind].map((m) => {
      const path = (m.path?.trim() || (m.key ? facetManagedPath(kind, m.key) : '')).trim()
      if (!path) return m
      const loaded = byPath[path]
      if (loaded == null) return m
      if (!overwriteExisting && (m.content ?? '').trim().length > 0) return m
      return { ...m, content: loaded, path: m.path?.trim() ? m.path : path }
    })
  }
  return next
}

/** Snapshot project facet content keyed by managed path for unsaved-draft recovery. */
export function collectDraftFacetContentByPath(draft: WorkflowDraft): Record<string, string> {
  const out: Record<string, string> = {}
  for (const kind of FACET_KINDS) {
    for (const m of draft[kind]) {
      const key = m.key.trim()
      const content = m.content ?? ''
      if (!key) continue
      if (content.trim().length === 0) continue
      out[facetManagedPath(kind, key)] = content
    }
  }
  return out
}

/** Stable fingerprint for facet bodies edited outside workflow YAML. */
export function facetContentFingerprint(draft: WorkflowDraft): string {
  const parts: string[] = []
  for (const kind of FACET_KINDS) {
    for (const m of draft[kind]) {
      parts.push(`${kind}\0${m.key}\0${m.content ?? ''}`)
    }
  }
  return parts.join('\n')
}
