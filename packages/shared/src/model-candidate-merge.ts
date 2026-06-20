import type { ModelCandidateSource, ProviderModelCandidate } from './model-candidate-types.js'

const SOURCE_ORDER: ModelCandidateSource[] = ['live', 'history', 'workspace', 'suggested', 'saved']

export interface MergeProviderModelCandidatesInput {
  live?: Array<{ id: string; label?: string }>
  history?: string[]
  workspace?: string[]
  suggested?: string[]
  saved?: string[]
}

/** Merge model candidates; dedupe by id keeping the highest-priority source. */
export function mergeProviderModelCandidates(
  input: MergeProviderModelCandidatesInput,
): ProviderModelCandidate[] {
  const byId = new Map<string, ProviderModelCandidate>()

  const addTier = (
    source: ModelCandidateSource,
    entries: Array<{ id: string; label?: string }> | string[] | undefined,
  ) => {
    if (!entries) return
    for (const entry of entries) {
      const id = typeof entry === 'string' ? entry.trim() : entry.id.trim()
      if (!id || byId.has(id)) continue
      const label = typeof entry === 'string' ? undefined : entry.label
      byId.set(id, { id, source, ...(label ? { label } : {}) })
    }
  }

  addTier('live', input.live)
  addTier(
    'history',
    input.history?.map((id) => ({ id })),
  )
  addTier(
    'workspace',
    input.workspace?.map((id) => ({ id })),
  )
  addTier(
    'suggested',
    input.suggested?.map((id) => ({ id })),
  )
  addTier(
    'saved',
    input.saved?.map((id) => ({ id })),
  )

  const orderIndex = new Map(SOURCE_ORDER.map((s, i) => [s, i]))
  return [...byId.values()].sort((a, b) => {
    const sourceDiff =
      (orderIndex.get(a.source) ?? SOURCE_ORDER.length) -
      (orderIndex.get(b.source) ?? SOURCE_ORDER.length)
    if (sourceDiff !== 0) return sourceDiff
    return a.id.localeCompare(b.id)
  })
}
