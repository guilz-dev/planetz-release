import type { FacetKind } from './facet-types.js'

const FACET_KIND_FOLDERS: Record<FacetKind, string> = {
  personas: 'personas',
  policies: 'policies',
  knowledge: 'knowledge',
  instructions: 'instructions',
  reportFormats: 'output-contracts',
}

export function slugifyFacetKey(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'facet'
}

export function facetKindToFolder(kind: FacetKind): string {
  return FACET_KIND_FOLDERS[kind]
}

export function facetRelPath(kind: FacetKind, key: string): string {
  return `${facetKindToFolder(kind)}/${slugifyFacetKey(key)}.md`
}

/** Relative path under `.takt/facets/` for workflow facetFiles writes. */
export function facetStorageRelPath(kind: FacetKind, key: string): string {
  return `facets/${facetRelPath(kind, key)}`
}

/** Workflow-managed path (relative to workflow YAML). */
export function facetManagedPath(kind: FacetKind, key: string): string {
  return `../facets/${facetRelPath(kind, key)}`
}

export function catalogFacetKey(kind: FacetKind, key: string): string {
  return `${kind}:${key}`
}

export function emptyBuiltinFacetCatalog(): Record<FacetKind, string[]> {
  return {
    personas: [],
    policies: [],
    knowledge: [],
    instructions: [],
    reportFormats: [],
  }
}

export function suggestFacetDuplicateKey(
  baseKey: string,
  existingKeys: ReadonlySet<string>,
): string {
  const root = baseKey.trim() || 'facet'
  let candidate = `${root}-copy`
  let suffix = 2
  while (existingKeys.has(candidate)) {
    candidate = `${root}-copy-${suffix}`
    suffix += 1
  }
  return candidate
}
