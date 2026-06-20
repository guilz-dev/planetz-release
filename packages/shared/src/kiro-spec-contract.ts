import { z } from 'zod'

/** Pinned contract version for tolerant spec.json reads (see docs/specs/kiro-spec-contract.md). */
export const KIRO_SPEC_CONTRACT_VERSION = 1

export const KIRO_SPECS_DIR = '.kiro/specs'
export const KIRO_SPEC_JSON_FILE = 'spec.json'

export const KiroSpecApprovalPhaseSchema = z.enum(['requirements', 'design', 'tasks'])

export type KiroSpecApprovalPhase = z.infer<typeof KiroSpecApprovalPhaseSchema>

export const KiroSpecApprovalStateSchema = z
  .object({
    approved: z.boolean().optional(),
    approvedAt: z.string().optional(),
  })
  .passthrough()

export type KiroSpecApprovalState = z.infer<typeof KiroSpecApprovalStateSchema>

export const KiroSpecJsonSchema = z
  .object({
    version: z.number().optional(),
    language: z.string().optional(),
    approvals: z.record(z.string(), KiroSpecApprovalStateSchema).optional(),
  })
  .passthrough()

export type KiroSpecJson = z.infer<typeof KiroSpecJsonSchema>

export const KiroSpecParseStatusSchema = z.enum(['ok', 'missing', 'invalid'])

export type KiroSpecParseStatus = z.infer<typeof KiroSpecParseStatusSchema>

export const KiroSpecSummarySchema = z.object({
  featureId: z.string().min(1),
  specDirRel: z.string().min(1),
  parseStatus: KiroSpecParseStatusSchema,
  language: z.string().nullable().optional(),
  approvals: z
    .object({
      requirements: KiroSpecApprovalStateSchema.optional(),
      design: KiroSpecApprovalStateSchema.optional(),
      tasks: KiroSpecApprovalStateSchema.optional(),
    })
    .optional(),
})

export type KiroSpecSummary = z.infer<typeof KiroSpecSummarySchema>

export const KiroSpecGetInputSchema = z.object({
  featureId: z.string().min(1),
})

export type KiroSpecGetInput = z.infer<typeof KiroSpecGetInputSchema>

export const KiroSpecListResultSchema = z.object({
  specs: z.array(KiroSpecSummarySchema),
})

export const KiroSpecGetResultSchema = z.object({
  spec: KiroSpecSummarySchema,
})

/** Normalize approvals to known phases only. */
export function normalizeKiroSpecApprovals(
  raw: Record<string, KiroSpecApprovalState> | undefined,
): Partial<Record<KiroSpecApprovalPhase, KiroSpecApprovalState>> {
  if (!raw) return {}
  const out: Partial<Record<KiroSpecApprovalPhase, KiroSpecApprovalState>> = {}
  for (const phase of KiroSpecApprovalPhaseSchema.options) {
    const state = raw[phase]
    if (state) out[phase] = state
  }
  return out
}

/** Tolerant parse; returns null when JSON is missing or invalid. */
export function parseKiroSpecJson(raw: string): KiroSpecJson | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = KiroSpecJsonSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function buildKiroSpecSummary(input: {
  featureId: string
  specDirRel: string
  rawJson?: string | null
}): KiroSpecSummary {
  if (!input.rawJson?.trim()) {
    return {
      featureId: input.featureId,
      specDirRel: input.specDirRel,
      parseStatus: 'missing',
    }
  }
  const parsed = parseKiroSpecJson(input.rawJson)
  if (!parsed) {
    return {
      featureId: input.featureId,
      specDirRel: input.specDirRel,
      parseStatus: 'invalid',
    }
  }
  return {
    featureId: input.featureId,
    specDirRel: input.specDirRel,
    parseStatus: 'ok',
    language: parsed.language ?? null,
    approvals: normalizeKiroSpecApprovals(parsed.approvals),
  }
}
