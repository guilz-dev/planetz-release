/** Source tier for effort candidate display (merge order: history → workspace → suggested → saved). */
export const EFFORT_CANDIDATE_SOURCES = ['history', 'workspace', 'suggested', 'saved'] as const

export type EffortCandidateSource = (typeof EFFORT_CANDIDATE_SOURCES)[number]

export interface ProviderEffortCandidate {
  id: string
  source: EffortCandidateSource
}

export interface EffortHistoryItem {
  provider: string
  effort: string
  lastUsedAt: string
  useCount: number
}

export interface ListProviderEffortsResult {
  efforts: ProviderEffortCandidate[]
}
