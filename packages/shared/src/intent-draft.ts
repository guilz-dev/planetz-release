import { z } from 'zod'

export interface IntentDraft {
  threadId: string
  autoGenerate: boolean
  what: string
  why: string
  outOfScopeText: string
  sourceTurnId?: string
  generatedAt?: string
  touchedByUser: boolean
  basedOnIntentVersion?: number | null
}

export const intentDraftSchema = z.object({
  threadId: z.string().trim().min(1),
  autoGenerate: z.boolean(),
  what: z.string(),
  why: z.string(),
  outOfScopeText: z.string(),
  sourceTurnId: z.string().trim().min(1).optional(),
  generatedAt: z.string().trim().min(1).optional(),
  touchedByUser: z.boolean(),
  basedOnIntentVersion: z.number().int().positive().nullable().optional(),
})

export const intentDraftThreadInputSchema = z.object({
  threadId: z.string().trim().min(1),
})

export const intentDraftSaveInputSchema = intentDraftSchema

export const intentDraftGenerateInputSchema = z.object({
  threadId: z.string().trim().min(1),
  sourceTurnId: z.string().trim().min(1).optional(),
})

export type IntentDraftThreadInput = z.infer<typeof intentDraftThreadInputSchema>
export type IntentDraftSaveInput = z.infer<typeof intentDraftSaveInputSchema>
export type IntentDraftGenerateInput = z.infer<typeof intentDraftGenerateInputSchema>
