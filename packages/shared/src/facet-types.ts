/** Facet kinds aligned with workflow YAML sections and `.takt/facets/` folders. */
export const FACET_KINDS = [
  'personas',
  'policies',
  'knowledge',
  'instructions',
  'reportFormats',
] as const

export type FacetKind = (typeof FACET_KINDS)[number]

export type FacetFileSource = 'project' | 'user' | 'builtin' | 'missing'

export interface ProjectFacetSummary {
  kind: FacetKind
  key: string
  managedPath: string
}

export interface FacetDocument {
  kind: FacetKind
  key: string
  source: FacetFileSource
  content: string | null
  managedPath: string
}

export interface FacetUsageSummary {
  workflowCount: number
  stepCount: number
  workflowNames: string[]
}
