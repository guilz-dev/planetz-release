import { z } from 'zod'

/** Minimum score lead library top must have over core top before suggesting opt-in. */
export const LIBRARY_AUTO_SUGGESTION_SCORE_MARGIN = 0.15

/** Do not suggest when core top already scores at or above this value. */
export const LIBRARY_AUTO_SUGGESTION_CORE_SCORE_CEILING = 0.85

/** Cap library workflows evaluated per deterministic preview. */
export const LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES = 8

export const libraryAutoSuggestionSchema = z.object({
  workflowName: z.string(),
  score: z.number(),
  displayName: z.string().optional(),
  tierReason: z.string().optional(),
  packId: z.string().optional(),
})

export type LibraryAutoSuggestion = z.infer<typeof libraryAutoSuggestionSchema>
