import type { EffortCandidateSource, ProviderEffortCandidate } from './effort-candidate-types.js'

const SOURCE_ORDER: EffortCandidateSource[] = ['history', 'workspace', 'suggested', 'saved']

export interface MergeProviderEffortCandidatesInput {
  history?: string[]
  workspace?: string[]
  suggested?: string[]
  saved?: string[]
}

/** Merge effort candidates; dedupe by id keeping the highest-priority source. */
export function mergeProviderEffortCandidates(
  input: MergeProviderEffortCandidatesInput,
): ProviderEffortCandidate[] {
  const byId = new Map<string, ProviderEffortCandidate>()

  const addTier = (source: EffortCandidateSource, ids: string[] | undefined) => {
    if (!ids) return
    for (const raw of ids) {
      const id = raw.trim()
      if (!id || byId.has(id)) continue
      byId.set(id, { id, source })
    }
  }

  addTier('history', input.history)
  addTier('workspace', input.workspace)
  addTier('suggested', input.suggested)
  addTier('saved', input.saved)

  const orderIndex = new Map(SOURCE_ORDER.map((s, i) => [s, i]))
  return [...byId.values()].sort((a, b) => {
    const sourceDiff =
      (orderIndex.get(a.source) ?? SOURCE_ORDER.length) -
      (orderIndex.get(b.source) ?? SOURCE_ORDER.length)
    if (sourceDiff !== 0) return sourceDiff
    return a.id.localeCompare(b.id)
  })
}
