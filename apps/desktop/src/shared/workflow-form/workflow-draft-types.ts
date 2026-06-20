export type RuleMode = 'tag' | 'ai' | 'all' | 'any'

export interface RuleDraft {
  id: string
  mode: RuleMode
  text: string
  next: string
  /** Subworkflow return target when `next` is omitted (from `rules[].return`). */
  return?: string
  appendix?: string
  /** Original rule object for non-lossy round-trip (requires_user_input, etc.). */
  raw?: Record<string, unknown>
}

export type SpecialKind = 'parallel' | 'arpeggio' | 'team_leader' | 'workflow_call'

export interface StepDraft {
  id: string
  name: string
  provider?: string
  model?: string
  persona?: string
  edit?: boolean
  permission?: 'readonly' | 'edit' | 'full'
  passPrevious?: boolean
  instruction?: string
  rules: RuleDraft[]
  special?: SpecialKind
  raw: Record<string, unknown>
}

export interface SectionMap {
  key: string
  path: string
  content?: string
}

export type FacetKind = 'personas' | 'policies' | 'knowledge' | 'instructions' | 'reportFormats'

export const FACET_KINDS: FacetKind[] = [
  'personas',
  'policies',
  'knowledge',
  'instructions',
  'reportFormats',
]

export interface WorkflowDraft {
  name: string
  description?: string
  initialStep?: string
  maxSteps?: number
  personas: SectionMap[]
  policies: SectionMap[]
  knowledge: SectionMap[]
  instructions: SectionMap[]
  reportFormats: SectionMap[]
  steps: StepDraft[]
  workflowConfig?: unknown
  loopMonitors?: unknown
  rateLimitFallback?: unknown
  subworkflow?: unknown
  unsupportedKeys: string[]
  parseError?: string
  /** Loaded facet bodies keyed by workflow-managed path (not serialized to YAML). */
  facetContentByPath?: Record<string, string>
}

export type WorkflowFormMode = 'full' | 'partial' | 'yaml-only'
