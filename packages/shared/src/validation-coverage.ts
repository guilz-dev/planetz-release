import { z } from 'zod'
import { SPEC_ARTIFACT_ID_PREFIXES } from './intent-ledger-trace.js'

const REQ_DECLARATION_PATTERN = new RegExp(
  [
    '^',
    '(?:###\\s+|[-*]\\s+|\\d+\\.\\s+)?',
    '`?',
    `(${SPEC_ARTIFACT_ID_PREFIXES.requirements}-[a-z0-9-]+-\\d+)`,
    '`?',
    '(?=\\s|$)',
  ].join(''),
  'gim',
)

/** List stable REQ ids from requirements markdown declarations at line start. */
export function parseRequirementIdsFromMarkdown(markdown: string): string[] {
  const ids = new Set<string>()
  for (const match of markdown.matchAll(REQ_DECLARATION_PATTERN)) {
    const id = match[1]?.trim()
    if (id) ids.add(id)
  }
  return [...ids].sort()
}

/** REQ ids in requirements that have no intent link for the thread. */
export function orphanRequirementIds(
  requirementIds: readonly string[],
  linkedReqIds: ReadonlySet<string>,
): string[] {
  return requirementIds.filter((reqId) => !linkedReqIds.has(reqId))
}

/** Thread has decided intent but zero requirement intent links. */
export function isNakedDecidedIntent(hasDecidedIntent: boolean, linkedReqCount: number): boolean {
  return hasDecidedIntent && linkedReqCount === 0
}

export const ValidationCoverageThreadSummarySchema = z.object({
  threadId: z.string().min(1),
  orphanReqIds: z.array(z.string()),
  linkedReqCount: z.number().int().nonnegative(),
  hasDecidedIntent: z.boolean(),
  isNaked: z.boolean(),
})

export const ValidationCoverageSummarySchema = z.object({
  orphanReqCount: z.number().int().nonnegative(),
  nakedIntentThreadCount: z.number().int().nonnegative(),
  threads: z.array(ValidationCoverageThreadSummarySchema),
})

export type ValidationCoverageThreadSummary = z.infer<typeof ValidationCoverageThreadSummarySchema>
export type ValidationCoverageSummary = z.infer<typeof ValidationCoverageSummarySchema>

export interface ValidationCoverageThreadInput {
  threadId: string
  requirementIds: readonly string[]
  linkedReqIds: readonly string[]
  hasDecidedIntent: boolean
}

export function computeValidationCoverage(input: {
  threads: readonly ValidationCoverageThreadInput[]
}): ValidationCoverageSummary {
  const threads: ValidationCoverageThreadSummary[] = input.threads.map((thread) => {
    const linkedSet = new Set(thread.linkedReqIds)
    const orphanReqIds = orphanRequirementIds(thread.requirementIds, linkedSet)
    const linkedReqCount = linkedSet.size
    return {
      threadId: thread.threadId,
      orphanReqIds,
      linkedReqCount,
      hasDecidedIntent: thread.hasDecidedIntent,
      isNaked: isNakedDecidedIntent(thread.hasDecidedIntent, linkedReqCount),
    }
  })

  const orphanReqCount = threads.reduce((sum, thread) => sum + thread.orphanReqIds.length, 0)
  const nakedIntentThreadCount = threads.filter((thread) => thread.isNaked).length

  return { orphanReqCount, nakedIntentThreadCount, threads }
}
