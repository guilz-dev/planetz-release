import { SPEC_ARTIFACT_ID_PREFIXES } from './intent-ledger-trace.js'

/** Slug used in REQ-{feature}-{n} when no feature hint exists. */
export const DEFAULT_REQUIREMENTS_FEATURE_SLUG = 'adopted'

/** Derive feature slug for REQ id allocation from trace hints. */
export function deriveRequirementsFeatureSlug(input: {
  relatedReqIds?: string[] | null
  scopeHint?: string | null
  taskId?: string | null
}): string {
  for (const reqId of input.relatedReqIds ?? []) {
    const match = /^REQ-([a-z0-9-]+)-\d+$/i.exec(reqId.trim())
    if (match?.[1]) return match[1].toLowerCase()
  }
  const scope = input.scopeHint?.trim()
  if (scope) {
    const slug = scope
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (slug.length > 0) return slug.slice(0, 32)
  }
  const taskId = input.taskId?.trim()
  if (taskId) {
    const slug = taskId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (slug.length > 0) return slug.slice(0, 32)
  }
  return DEFAULT_REQUIREMENTS_FEATURE_SLUG
}

/** Allocate the next REQ id from existing requirements markdown (append-only). */
export function allocateNextRequirementId(existingMarkdown: string, featureSlug: string): string {
  const prefix = `${SPEC_ARTIFACT_ID_PREFIXES.requirements}-${featureSlug}-`
  const regex = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`, 'gi')
  let max = 0
  for (const match of existingMarkdown.matchAll(regex)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return `${prefix}${max + 1}`
}

/** Append-only EARS-style block for an adopted observation/decision. */
export function formatAdoptedRequirementBlock(input: {
  reqId: string
  statement: string
  sourceRun: string
  decisionId: string
}): string {
  const statement = input.statement.replace(/\r?\n+/g, ' ').trim()
  return [
    '',
    `### ${input.reqId}`,
    '',
    `WHEN the system operates THEN ${statement}`,
    '',
    `- **Authority**: adopted (intent ledger)`,
    `- **Source run**: ${input.sourceRun}`,
    `- **Decision id**: ${input.decisionId}`,
    '',
  ].join('\n')
}
