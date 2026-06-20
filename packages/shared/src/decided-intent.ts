import { z } from 'zod'

/**
 * Decided Intent: a structured, append-only "true requirement" document for a
 * Spec Thread (what / why / out-of-scope). Each save adds a new version; the
 * latest version is the current intent. Versioning is the primary axis, so this
 * lives in a dedicated table rather than folded into a single ledger statement.
 */
export interface DecidedIntent {
  /** Stable synthetic id (`<threadId>#v<version>`) for UI keys. */
  id: string
  threadId: string
  version: number
  what: string
  why: string
  outOfScope: string[]
  /** Why this version was recorded (change note); null for the first version. */
  reason: string | null
  createdAt: string
}

export const decidedIntentThreadInputSchema = z.object({
  threadId: z.string().min(1),
})

export const decidedIntentSaveInputSchema = z.object({
  threadId: z.string().min(1),
  what: z.string().trim().min(1),
  why: z.string().trim().min(1),
  outOfScope: z.array(z.string().trim().min(1)).optional(),
  reason: z.string().trim().min(1).optional(),
})

export type DecidedIntentThreadInput = z.infer<typeof decidedIntentThreadInputSchema>
export type DecidedIntentSaveInput = z.infer<typeof decidedIntentSaveInputSchema>
