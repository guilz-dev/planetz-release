import { z } from 'zod'

/** Machine-readable intent link report produced by business-analyst (run reports/). */
export const INTENT_LINKS_REPORT_FILE = 'intent-links.json'

/** Requirements artifact SSoT for REQ id parsing (run reports/). */
export const REQUIREMENTS_REPORT_FILE = 'requirements.md'

/** Knowledge facet key for decided intent context injected before analyze_requirements. */
export const DECIDED_INTENT_CONTEXT_FACET_KEY = 'decided-intent-context'

/** Direct link from a REQ id to the Decided Intent version that justified it. */
export interface RequirementIntentLink {
  reqId: string
  threadId: string
  decidedIntentVersion: number
  rationale: string
  sourceTaskId?: string | null
  createdAt: string
}

export const IntentLinksReportEntrySchema = z.object({
  reqId: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
})

export const IntentLinksReportSchema = z.object({
  version: z.literal(1),
  links: z.array(IntentLinksReportEntrySchema),
})

export type IntentLinksReport = z.infer<typeof IntentLinksReportSchema>
export type IntentLinksReportEntry = z.infer<typeof IntentLinksReportEntrySchema>
