import {
  type AutoWorkflowDecision,
  getBuiltinWorkflowTierMeta,
  LIBRARY_AUTO_SUGGESTION_CORE_SCORE_CEILING,
  LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES,
  LIBRARY_AUTO_SUGGESTION_SCORE_MARGIN,
  type LibraryAutoSuggestion,
  type TaskRoutingRequirements,
  type WorkflowLibraryUiPrefs,
  type WorkflowRoutingAuditRecord,
  type WorkflowRoutingCatalog,
  type WorkflowSource,
} from '@planetz/shared'
import { buildScoredRoutingCandidates } from './candidate-builder.js'
import type { WorkflowAutoRouteContext } from './router.js'
import { buildWorkflowFeatureIndex } from './workflow-feature-index.js'

const PROMPT_LIBRARY_KEYWORDS: ReadonlyArray<{
  pattern: RegExp
  workflowNames: readonly string[]
}> = [
  { pattern: /\bterraform\b/i, workflowNames: ['terraform'] },
  { pattern: /\b(infra|iac|infrastructure)\b/i, workflowNames: ['terraform'] },
  { pattern: /\baudit\b/i, workflowNames: ['audit-unit', 'audit-e2e', 'audit-security'] },
]

export function selectLibraryAutoSuggestionCandidateNames(input: {
  prompt: string
  availableWorkflowNames: string[]
  workflowsByName: ReadonlyMap<string, WorkflowSource>
  uiPrefs: WorkflowLibraryUiPrefs
}): string[] {
  const autoEnabled = new Set(input.uiPrefs.autoEnabledWorkflows)
  const normalizedPrompt = input.prompt.toLowerCase()
  const keywordHits = new Set<string>()
  for (const rule of PROMPT_LIBRARY_KEYWORDS) {
    if (!rule.pattern.test(normalizedPrompt)) continue
    for (const name of rule.workflowNames) keywordHits.add(name)
  }
  if (keywordHits.size === 0) return []

  const names: string[] = []
  for (const name of input.availableWorkflowNames) {
    if (input.workflowsByName.get(name) !== 'builtin') continue
    if (getBuiltinWorkflowTierMeta(name).tier !== 'library') continue
    if (getBuiltinWorkflowTierMeta(name).lifecycle === 'deprecated') continue
    if (autoEnabled.has(name)) continue
    if (!keywordHits.has(name)) continue
    names.push(name)
  }

  return names.slice(0, LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES)
}

function topViablePoolScore(audit: WorkflowRoutingAuditRecord | undefined): number {
  if (!audit) return 0
  const viable = audit.candidatePool.filter((entry) => !entry.rejected)
  if (viable.length === 0) return 0
  return Math.max(...viable.map((entry) => entry.score))
}

function promptKeywordMatchedLibrary(prompt: string, libraryNames: readonly string[]): boolean {
  const normalizedPrompt = prompt.toLowerCase()
  for (const rule of PROMPT_LIBRARY_KEYWORDS) {
    if (!rule.pattern.test(normalizedPrompt)) continue
    if (rule.workflowNames.some((name) => libraryNames.includes(name))) return true
  }
  return false
}

/** Shadow scoring: explicit library keywords imply the user chose that implementation path. */
function shadowRequirementsForLibrary(
  requirements: TaskRoutingRequirements,
  prompt: string,
  libraryNames: readonly string[],
): TaskRoutingRequirements {
  if (requirements.implementationAlreadyDecided) return requirements
  if (!promptKeywordMatchedLibrary(prompt, libraryNames)) return requirements
  return { ...requirements, implementationAlreadyDecided: true }
}

export async function suggestLibraryAutoEnablement(input: {
  prompt: string
  decision: AutoWorkflowDecision
  audit?: WorkflowRoutingAuditRecord
  catalog: WorkflowRoutingCatalog
  availableWorkflowNames: string[]
  workflowsByName: ReadonlyMap<string, WorkflowSource>
  uiPrefs: WorkflowLibraryUiPrefs
  requirements: TaskRoutingRequirements
  ctx: WorkflowAutoRouteContext
}): Promise<LibraryAutoSuggestion | undefined> {
  if (input.decision.confidence === 'high') return undefined

  const coreTopScore = topViablePoolScore(input.audit)
  if (coreTopScore >= LIBRARY_AUTO_SUGGESTION_CORE_SCORE_CEILING) return undefined

  const libraryNames = selectLibraryAutoSuggestionCandidateNames({
    prompt: input.prompt,
    availableWorkflowNames: input.availableWorkflowNames,
    workflowsByName: input.workflowsByName,
    uiPrefs: input.uiPrefs,
  })
  if (libraryNames.length === 0) return undefined

  const featureIndex = input.ctx.featureCache
    ? await input.ctx.featureCache.resolveMissing(libraryNames, input.ctx.resolveWorkflowYaml)
    : await buildWorkflowFeatureIndex(libraryNames, input.ctx.resolveWorkflowYaml)

  const shadowCatalog: WorkflowRoutingCatalog = {
    ...input.catalog,
    workflows: input.catalog.workflows.map((entry) =>
      libraryNames.includes(entry.name) ? { ...entry, enabledForAuto: true } : entry,
    ),
  }

  const shadowRequirements = shadowRequirementsForLibrary(
    input.requirements,
    input.prompt,
    libraryNames,
  )

  const pool = buildScoredRoutingCandidates({
    catalog: shadowCatalog,
    featuresByName: featureIndex,
    requirements: shadowRequirements,
    availableWorkflowNames: libraryNames,
  })
  const viable = pool.filter((candidate) => !candidate.rejected)
  if (viable.length === 0) return undefined

  viable.sort((a, b) => b.score - a.score)
  const top = viable[0]
  if (!top) return undefined
  if (top.score < coreTopScore + LIBRARY_AUTO_SUGGESTION_SCORE_MARGIN) return undefined

  const meta = getBuiltinWorkflowTierMeta(top.workflowName)
  return {
    workflowName: top.workflowName,
    score: top.score,
    displayName: meta.displayName,
    tierReason: meta.tierReason,
    packId: meta.packId,
  }
}
