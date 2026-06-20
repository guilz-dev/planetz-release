import type { PlanetzSessionPolicy } from './orbit-interactive-contract.js'

/** Normalized draft key for Composer Assist resume matching. */
export interface ComposerAssistDraftKey {
  seedBody?: string
  workflow?: string
  sourceContext?: string
  effort?: string
  provider?: string
  model?: string
  sessionPolicy?: PlanetzSessionPolicy
}

function normalizedDraftField(value: string | undefined): string {
  return value?.trim() ?? ''
}

/** True when the current composer input targets the same draft as a persisted session. */
export function composerAssistDraftMatchesInput(
  input: ComposerAssistDraftKey,
  draft: ComposerAssistDraftKey,
): boolean {
  return (
    normalizedDraftField(input.seedBody) === normalizedDraftField(draft.seedBody) &&
    normalizedDraftField(input.workflow) === normalizedDraftField(draft.workflow) &&
    normalizedDraftField(input.sourceContext) === normalizedDraftField(draft.sourceContext) &&
    normalizedDraftField(input.effort) === normalizedDraftField(draft.effort) &&
    normalizedDraftField(input.provider) === normalizedDraftField(draft.provider) &&
    normalizedDraftField(input.model) === normalizedDraftField(draft.model) &&
    normalizedDraftField(input.sessionPolicy) === normalizedDraftField(draft.sessionPolicy)
  )
}
