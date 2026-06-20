import { z } from 'zod'
import type { ExecutionAnalyticsWindow } from './execution-analytics-types.js'

export {
  type DecisionTraceInput,
  isDecisionUnanchored,
  isLedgerEntryUnanchored,
  type LedgerUnanchoredInput,
  SPEC_ARTIFACT_ID_PREFIXES,
} from './intent-ledger-trace.js'

/** Authority values stored in intent_ledger (lowercase). */
export const INTENT_LEDGER_AUTHORITY_VALUES = [
  'required',
  'designed',
  'assumed',
  'observed',
  'ratified',
  'reversed',
] as const

export const IntentLedgerAuthoritySchema = z.enum(INTENT_LEDGER_AUTHORITY_VALUES)

export const DecisionReportAuthoritySchema = z.enum(['required', 'designed', 'assumed'])

export const DecisionReportReversibilitySchema = z.enum(['cheap', 'expensive'])

/** Single decision entry inside reports/decisions.json. */
export const DecisionReportItemSchema = z.object({
  decisionId: z.string().min(1),
  statement: z.string().min(1),
  authority: DecisionReportAuthoritySchema,
  source: z.string().optional(),
  satisfies: z.array(z.string().min(1)).optional(),
  deviates: z.array(z.string().min(1)).optional(),
  reversibility: DecisionReportReversibilitySchema.optional(),
  scopeHint: z.string().optional(),
})

/** Canonical machine-readable decision report (S3 ingest input). */
export const DecisionReportSchema = z.object({
  version: z.literal(1).default(1),
  decisions: z.array(DecisionReportItemSchema),
})

export type IntentLedgerAuthority = z.infer<typeof IntentLedgerAuthoritySchema>
export type DecisionReportAuthority = z.infer<typeof DecisionReportAuthoritySchema>
export type DecisionReportReversibility = z.infer<typeof DecisionReportReversibilitySchema>
export type DecisionReportItem = z.infer<typeof DecisionReportItemSchema>
export type DecisionReport = z.infer<typeof DecisionReportSchema>

/** Fixed report file name produced by spec-driven implement steps. */
export const INTENT_LEDGER_DECISIONS_REPORT_FILE = 'decisions.json'

/** Machine-readable observation report from spec-driven observe step (PR-05/06). */
export const INTENT_LEDGER_OBSERVATION_REPORT_FILE = 'observation.json'

export const ObservationReportStatusSchema = z.enum(['GO', 'NO-GO'])

/** Single observation row inside observation.json. */
export const ObservationReportItemSchema = z.object({
  observationId: z.string().min(1).optional(),
  statement: z.string().min(1),
  evidence: z.string().min(1),
  relatedReqIds: z.array(z.string().min(1)).optional(),
  unanchored: z.boolean(),
})

export const ObservationReportSchema = z.object({
  version: z.literal(1).default(1),
  STATUS: ObservationReportStatusSchema,
  observations: z.array(ObservationReportItemSchema),
})

export type ObservationReportStatus = z.infer<typeof ObservationReportStatusSchema>
export type ObservationReportItem = z.infer<typeof ObservationReportItemSchema>
export type ObservationReport = z.infer<typeof ObservationReportSchema>

/** How an operator adjudicated a pending entry (R4). Legacy ratify/reverse map to ratify/reverse kinds. */
export const ADJUDICATION_KIND_VALUES = ['adopt', 'fix', 'ratify', 'reverse'] as const

export const AdjudicationKindSchema = z.enum(ADJUDICATION_KIND_VALUES)

export type AdjudicationKind = z.infer<typeof AdjudicationKindSchema>

/** Drop observation rows with empty evidence before ingest. */
export function filterValidObservationItems(
  items: ObservationReportItem[],
): ObservationReportItem[] {
  return items.filter((item) => item.evidence.trim().length > 0)
}

/** Stable decision_id for observation ingest (explicit id or content hash). */
export function observationDecisionId(
  observation: ObservationReportItem,
  hashFn: (input: string) => string,
): string {
  const explicit = observation.observationId?.trim()
  if (explicit) return explicit
  const digest = hashFn(`${observation.statement}\0${observation.evidence}`)
  return `obs-${digest}`
}

/** Knowledge facet key regenerated from intent_ledger before task runs (S5). */
export const ESTABLISHED_DECISIONS_FACET_KEY = 'established-decisions'

/** Max scope-less supply entries injected per task (oldest first). */
export const ESTABLISHED_DECISIONS_MAX_UNSCOPED_ENTRIES = 10

/** Max total supply entries injected per task after scope filtering. */
export const ESTABLISHED_DECISIONS_MAX_SUPPLY_ENTRIES = 50

/** Row shape exposed to renderer via IPC. */
export const IntentLedgerEntrySchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  sourceRun: z.string().min(1),
  decisionId: z.string().min(1),
  statement: z.string().min(1),
  authority: IntentLedgerAuthoritySchema,
  scopeHint: z.string().nullable(),
  sourceDoc: z.string().nullable(),
  sourceRunDoc: z.string().nullable(),
  createdAt: z.string().min(1),
  ratifiedAt: z.string().nullable(),
  reversibility: DecisionReportReversibilitySchema.nullable(),
  satisfies: z.array(z.string()).nullable().optional(),
  deviates: z.array(z.string()).nullable().optional(),
  /** True when no satisfies/deviates/sourceDoc anchor exists (R2). */
  unanchored: z.boolean().optional(),
  /** True when scope_hint overlaps an existing ratified entry (S6-lite recurrence proxy). */
  scopeConflict: z.boolean().optional(),
  /** Set when operator adjudicates assumed/observed (PR-08). */
  adjudicationKind: AdjudicationKindSchema.nullable().optional(),
  adjudicationReason: z.string().nullable().optional(),
  /** REQ id appended on adopt promotion (PR-09). */
  promotedReqId: z.string().nullable().optional(),
})

export type IntentLedgerEntry = z.infer<typeof IntentLedgerEntrySchema>

/** Aggregated intent-ledger KPIs for Execution Summary (S6-lite). */
export const IntentLedgerSummarySchema = z.object({
  window: z.enum(['24h', '7d', '30d', 'all']),
  ingestedAssumedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  ratifiedCount: z.number().int().nonnegative(),
  reversedCount: z.number().int().nonnegative(),
  adjudicationRate: z.number().min(0).max(1).nullable(),
  scopeConflictCount: z.number().int().nonnegative(),
  unanchoredCount: z.number().int().nonnegative(),
  /** Share of assumed ingest cohort in window with no trace anchor (R5). */
  unanchoredRate: z.number().min(0).max(1).nullable(),
  /** Median ms from ingest (created_at) to ratify/reverse (ratified_at) in window. */
  adjudicationLatencyP50Ms: z.number().int().nonnegative().nullable(),
  /** ratified / (ratified + reversed) in window; null when none adjudicated. */
  ratifyRatio: z.number().min(0).max(1).nullable(),
  /** reversed / (ratified + reversed) in window; null when none adjudicated. */
  reverseRatio: z.number().min(0).max(1).nullable(),
  /** Entries adjudicated with kind=adopt in window; window uses `ratified_at` (PR-08). */
  adoptCount: z.number().int().nonnegative(),
  /** Entries adjudicated with kind=fix in window; window uses `ratified_at` (PR-08). */
  fixCount: z.number().int().nonnegative(),
})

export type IntentLedgerSummary = z.infer<typeof IntentLedgerSummarySchema>

export type IntentLedgerSummaryWindow = ExecutionAnalyticsWindow
