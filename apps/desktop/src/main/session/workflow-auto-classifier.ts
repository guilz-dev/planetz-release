/** Rule-based group/requirements inference for routing LLM fallback (not the structure-match ranker). */
import {
  matchRoutingTargetSurfacesFromText,
  promptIncludesRoutingKeyword,
  promptMentionsTesting,
  type RoutingGroup,
  type TaskRoutingRequirements,
} from '@planetz/shared'

const GROUP_KEYWORDS: Record<RoutingGroup, readonly string[]> = {
  bugfix: ['bug', 'fix', 'error', 'crash', 'broken', 'regression', 'defect', 'hotfix'],
  feature: ['feature', 'implement', 'add', 'build', 'create', 'develop'],
  refactor: ['refactor', 'cleanup', 'restructure', 'rename'],
  docs: ['doc', 'documentation', 'readme', 'comment', 'changelog'],
  ops: ['deploy', 'ops', 'infra', 'ci', 'pipeline', 'release', 'monitor'],
  research: ['spike', 'research', 'investigate', 'explore', 'poc', 'prototype'],
  review: ['review', 'audit', 'pr', 'pull request'],
  general: [],
}

const READ_ONLY_HINTS = [
  'investigate',
  'research',
  'why',
  'root cause',
  'analyze',
  'analysis',
  'explore',
  'spike',
  '調査',
  '原因',
  '確認',
]
const IMPLEMENT_HINTS = [
  'implement',
  'fix',
  'add',
  'build',
  'create',
  'develop',
  '実装',
  '修正',
  '追加',
]
const REVIEW_HINTS = ['review', 'audit', 'pr', 'レビュー']

const CONDITIONAL_IMPLEMENTATION_HINTS = [
  'if needed',
  'if necessary',
  'when needed',
  'as needed',
  'might need',
  'may need',
  'optionally',
  'optional',
  '必要なら',
  '必要に応じ',
  '場合によって',
  '必要であれば',
  '必要な場合',
]

export function normalizePromptForRouting(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function classifyGroupCandidates(normalizedPrompt: string): RoutingGroup[] {
  if (normalizedPrompt.length === 0) return ['general']

  const scores = new Map<RoutingGroup, number>()
  for (const [group, keywords] of Object.entries(GROUP_KEYWORDS) as [
    RoutingGroup,
    readonly string[],
  ][]) {
    if (group === 'general') continue
    let hits = 0
    for (const keyword of keywords) {
      if (promptIncludesRoutingKeyword(normalizedPrompt, keyword)) hits += 1
    }
    if (hits > 0) scores.set(group, hits)
  }

  if (scores.size === 0) return ['general']

  const maxHits = Math.max(...scores.values())
  const topGroups = [...scores.entries()]
    .filter(([, hits]) => hits === maxHits)
    .map(([group]) => group)
    .sort((a, b) => a.localeCompare(b))

  return topGroups.length > 0 ? topGroups : ['general']
}

export function inferTargetSurfacesFromPrompt(normalizedPrompt: string) {
  return matchRoutingTargetSurfacesFromText(normalizedPrompt)
}

function promptIncludesAnyHint(normalizedPrompt: string, hints: readonly string[]): boolean {
  return hints.some((hint) => promptIncludesRoutingKeyword(normalizedPrompt, hint))
}

function hasConditionalImplementationHint(normalizedPrompt: string): boolean {
  return CONDITIONAL_IMPLEMENTATION_HINTS.some((hint) => normalizedPrompt.includes(hint))
}

function inferImplementationAlreadyDecided(normalizedPrompt: string): boolean {
  if (!promptIncludesAnyHint(normalizedPrompt, IMPLEMENT_HINTS)) return false
  return !hasConditionalImplementationHint(normalizedPrompt)
}

/** Rule-based fallback when task-requirements LLM is unavailable or fails. */
export function inferTaskRoutingRequirementsFromPrompt(prompt: string): TaskRoutingRequirements {
  const normalized = normalizePromptForRouting(prompt)
  const groups = classifyGroupCandidates(normalized)

  const intent: TaskRoutingRequirements['intent'] = []
  if (groups.includes('research') || promptIncludesAnyHint(normalized, READ_ONLY_HINTS)) {
    intent.push('investigate')
  }
  if (groups.includes('review') || promptIncludesAnyHint(normalized, REVIEW_HINTS)) {
    intent.push('review')
  }
  if (
    groups.includes('bugfix') ||
    groups.includes('feature') ||
    promptIncludesAnyHint(normalized, IMPLEMENT_HINTS)
  ) {
    intent.push('implement')
  }
  if (groups.includes('refactor')) intent.push('refactor')
  if (intent.length === 0) intent.push('implement')

  const mayModifyCode =
    !promptIncludesAnyHint(normalized, READ_ONLY_HINTS) ||
    promptIncludesAnyHint(normalized, IMPLEMENT_HINTS)
  const implementationAlreadyDecided = inferImplementationAlreadyDecided(normalized)

  const expectedOutput: TaskRoutingRequirements['expectedOutput'] = []
  if (intent.includes('investigate')) expectedOutput.push('report')
  if (intent.includes('implement')) expectedOutput.push('code')
  if (promptMentionsTesting(normalized)) expectedOutput.push('tests')
  if (intent.includes('review')) expectedOutput.push('review-findings')
  if (expectedOutput.length === 0) expectedOutput.push('code')

  return {
    intent,
    expectedOutput,
    mayModifyCode,
    implementationAlreadyDecided,
    needsRootCauseAnalysis:
      groups.includes('bugfix') || promptIncludesRoutingKeyword(normalized, 'root cause'),
    needsTestWriting: promptMentionsTesting(normalized),
    needsDeepReview: intent.includes('review'),
    targetSurfaces: inferTargetSurfacesFromPrompt(normalized),
    ambiguity: normalized.length < 20 ? 'high' : 'medium',
    blockingUnknowns: [],
  }
}
