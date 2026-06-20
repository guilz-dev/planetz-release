/** Stable ID prefixes for spec-driven artifacts (see docs/specs/sdd-phase-contract.md). */
export const SPEC_ARTIFACT_ID_PREFIXES = {
  requirements: 'REQ',
  design: 'DSN',
  tasks: 'TSK',
} as const

export type DecisionTraceInput = {
  satisfies?: string[] | null
  deviates?: string[] | null
  /** decisions.json field; persisted as sourceDoc in intent_ledger. */
  source?: string | null
  sourceDoc?: string | null
}

export type LedgerUnanchoredInput = DecisionTraceInput & {
  authority?: string | null
  /** observation.json unanchored flag; persisted for authority=observed only. */
  observedUnanchored?: boolean | null
}

function hasNonemptyIdList(ids?: string[] | null): boolean {
  return (ids?.length ?? 0) > 0
}

/**
 * True when a decision has no trace link to requirements/design/tasks IDs or source doc.
 * Single source of truth for unanchored — repository and ingest must call this only.
 */
export function isDecisionUnanchored(input: DecisionTraceInput): boolean {
  if (hasNonemptyIdList(input.satisfies)) return false
  if (hasNonemptyIdList(input.deviates)) return false
  const source = (input.source ?? input.sourceDoc ?? '').trim()
  return source.length === 0
}

/**
 * Unanchored flag for ledger rows. Observed rows use persisted observation.unanchored;
 * evidence in sourceDoc is not treated as a spec anchor for observed authority.
 */
export function isLedgerEntryUnanchored(input: LedgerUnanchoredInput): boolean {
  if (input.authority === 'observed') {
    return input.observedUnanchored === true
  }
  return isDecisionUnanchored(input)
}
