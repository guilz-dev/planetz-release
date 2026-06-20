import {
  getBuiltinWorkflowTierMeta,
  getLibraryPackId,
  isCoreBuiltinWorkflow,
  resolveBuiltinWorkflowTier,
} from './builtin-workflow-tier.js'

export const MINI_FAMILY_CANONICAL_WORKFLOW = 'minimal'
export const REVIEW_FAMILY_CORE_WORKFLOW = 'review-default'

export type WorkflowFamilyKind = 'review' | 'audit' | 'mini' | 'experimental'

export type WorkflowRetirementSignal = 'consolidation_candidate' | 'experimental' | 'none'

const EXPERIMENTAL_PACK_ID = 'experimental'

/** Core workflow that anchors the review-* library family. */
export function isReviewFamilyCoreWorkflow(name: string): boolean {
  return name.trim() === REVIEW_FAMILY_CORE_WORKFLOW
}

export function isReviewFamilyDerivative(name: string): boolean {
  const trimmed = name.trim()
  return /^review-/.test(trimmed) && !isReviewFamilyCoreWorkflow(trimmed)
}

export function isAuditFamilyMember(name: string): boolean {
  const trimmed = name.trim()
  return /^audit-/.test(trimmed) || getLibraryPackId(trimmed) === 'audit'
}

export function isMiniFamilyCanonical(name: string): boolean {
  return name.trim() === MINI_FAMILY_CANONICAL_WORKFLOW
}

export function isMiniFamilyDerivative(name: string): boolean {
  const trimmed = name.trim()
  if (isMiniFamilyCanonical(trimmed)) return false
  return trimmed === 'default-mini' || /-mini$/.test(trimmed)
}

export function isExperimentalBuiltinWorkflow(name: string): boolean {
  if (resolveBuiltinWorkflowTier(name) !== 'library') return false
  return getBuiltinWorkflowTierMeta(name).packId === EXPERIMENTAL_PACK_ID
}

/**
 * Safe Phase 3 signal: marks workflows that may be consolidated or retired later.
 * Does not hide or delete workflows.
 */
export function isConsolidationCandidateWorkflow(name: string): boolean {
  return isReviewFamilyDerivative(name) || isAuditFamilyMember(name) || isMiniFamilyDerivative(name)
}

export function resolveWorkflowFamilyKind(name: string): WorkflowFamilyKind | undefined {
  if (isExperimentalBuiltinWorkflow(name)) return 'experimental'
  if (isReviewFamilyDerivative(name) || isReviewFamilyCoreWorkflow(name)) return 'review'
  if (isAuditFamilyMember(name)) return 'audit'
  if (isMiniFamilyCanonical(name) || isMiniFamilyDerivative(name)) return 'mini'
  return undefined
}

export function resolveWorkflowRetirementSignal(name: string): WorkflowRetirementSignal {
  if (isExperimentalBuiltinWorkflow(name)) return 'experimental'
  if (isConsolidationCandidateWorkflow(name)) return 'consolidation_candidate'
  return 'none'
}

/** Returns the preferred canonical workflow name for a family, when one exists in Core. */
export function resolveFamilyCanonicalWorkflowName(name: string): string | undefined {
  const kind = resolveWorkflowFamilyKind(name)
  if (kind === 'review' && !isReviewFamilyCoreWorkflow(name)) {
    return REVIEW_FAMILY_CORE_WORKFLOW
  }
  if (kind === 'mini' && isMiniFamilyDerivative(name)) {
    return MINI_FAMILY_CANONICAL_WORKFLOW
  }
  if (kind === 'audit' || kind === 'experimental') return undefined
  if (isCoreBuiltinWorkflow(name)) return name
  return undefined
}
