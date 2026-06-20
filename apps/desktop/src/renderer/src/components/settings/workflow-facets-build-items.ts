import type { FacetKind, WorkflowDraft } from './workflow-draft-types.js'
import { collectStepRefKeys, listStepNamesForFacetRef } from './workflow-facet-utils.js'

export type FacetListingSource = 'workflowMap' | 'stepRef' | 'bundledCatalog'

export interface FacetTreeBuildItem {
  kind: FacetKind
  key: string
  /** Editability: project = workflow map row, builtin = read-only */
  source: 'project' | 'builtin'
  listingSource: FacetListingSource
  index?: number
  stepReferences?: number
  referencingStepNames?: string[]
}

function countRefs(draft: WorkflowDraft, kind: FacetKind, key: string): number {
  return listStepNamesForFacetRef(draft, kind, key).length
}

export function buildFacetTreeItems(
  draft: WorkflowDraft,
  kind: FacetKind,
  builtinKeys: string[],
  showBuiltin: boolean,
): FacetTreeBuildItem[] {
  const items: FacetTreeBuildItem[] = []
  const projectMap = draft[kind]
  const listedKeys = new Set<string>()

  for (let i = 0; i < projectMap.length; i++) {
    const m = projectMap[i]
    if (!m.key) {
      items.push({
        kind,
        key: m.key,
        source: 'project',
        listingSource: 'workflowMap',
        index: i,
        stepReferences: 0,
        referencingStepNames: [],
      })
      continue
    }
    listedKeys.add(m.key)
    items.push({
      kind,
      key: m.key,
      source: 'project',
      listingSource: 'workflowMap',
      index: i,
      stepReferences: countRefs(draft, kind, m.key),
      referencingStepNames: listStepNamesForFacetRef(draft, kind, m.key),
    })
  }

  const stepRefs = collectStepRefKeys(draft, kind)
  for (const key of stepRefs) {
    if (!key || listedKeys.has(key)) continue
    listedKeys.add(key)
    items.push({
      kind,
      key,
      source: 'builtin',
      listingSource: 'stepRef',
      stepReferences: countRefs(draft, kind, key),
      referencingStepNames: listStepNamesForFacetRef(draft, kind, key),
    })
  }

  if (showBuiltin) {
    for (const key of builtinKeys) {
      if (!key || listedKeys.has(key)) continue
      listedKeys.add(key)
      items.push({
        kind,
        key,
        source: 'builtin',
        listingSource: 'bundledCatalog',
        stepReferences: countRefs(draft, kind, key),
        referencingStepNames: listStepNamesForFacetRef(draft, kind, key),
      })
    }
  }

  return items
}
