import { z } from 'zod'
import type { IntentLedgerAuthority } from './intent-ledger-schema.js'

/**
 * Spec Thread phase shown in the Spec Studio thread list. Drift takes priority
 * as an alert state; otherwise the phase follows clarify -> decided -> implementing.
 */
export type SpecThreadPhase = 'clarify' | 'decided' | 'implementing' | 'drift'

export interface SpecThreadSummary {
  threadId: string
  title: string
  phase: SpecThreadPhase
  /** Established decisions (required/designed/ratified) attached to the thread's tasks. */
  adrCount: number
  /** Assumed/observed entries awaiting adjudication. */
  pendingCount: number
  /** Pending observed entries that introduced unanchored decisions (drift). */
  driftCount: number
  taskCount: number
  hasDecidedIntent: boolean
  updatedAt: string
}

/** Minimal ledger projection needed to aggregate a Spec Thread summary. */
export interface SpecThreadLedgerFact {
  authority: IntentLedgerAuthority
  ratifiedAt: string | null
  observedUnanchored?: boolean | null
}

const ESTABLISHED_AUTHORITIES: ReadonlySet<IntentLedgerAuthority> = new Set([
  'required',
  'designed',
  'ratified',
])

export interface SpecThreadCounts {
  adrCount: number
  pendingCount: number
  driftCount: number
}

export function computeSpecThreadCounts(facts: readonly SpecThreadLedgerFact[]): SpecThreadCounts {
  let adrCount = 0
  let pendingCount = 0
  let driftCount = 0
  for (const fact of facts) {
    if (ESTABLISHED_AUTHORITIES.has(fact.authority)) adrCount += 1
    const isPending =
      (fact.authority === 'assumed' || fact.authority === 'observed') && fact.ratifiedAt === null
    if (isPending) {
      pendingCount += 1
      if (fact.authority === 'observed' && fact.observedUnanchored === true) driftCount += 1
    }
  }
  return { adrCount, pendingCount, driftCount }
}

export function resolveSpecThreadPhase(input: {
  hasDecidedIntent: boolean
  taskCount: number
  driftCount: number
}): SpecThreadPhase {
  if (input.driftCount > 0) return 'drift'
  if (input.taskCount > 0) return 'implementing'
  if (input.hasDecidedIntent) return 'decided'
  return 'clarify'
}

export const specThreadSummaryListInputSchema = z
  .object({
    limit: z.number().int().positive().optional(),
  })
  .optional()

export type SpecThreadSummaryListInput = z.infer<typeof specThreadSummaryListInputSchema>
