import { isChatOnlyWorkflowName } from './workflow-usage.js'

/**
 * Planetz product-UX classification for builtin workflows. Independent of the upstream
 * takt builtin YAML; kept as a separate overlay so it never widens {@link WorkflowSummary}.
 */
export type BuiltinWorkflowTier = 'core' | 'library' | 'system'

export type BuiltinWorkflowActivation = 'always' | 'workspace-opt-in' | 'hidden'

export type BuiltinWorkflowAutoPolicy = 'always' | 'opt-in' | 'never'

export type BuiltinWorkflowLifecycle = 'active' | 'experimental' | 'deprecated'

export interface BuiltinWorkflowTierMeta {
  /** Canonical internal workflow name (never replaced by displayName). */
  name: string
  tier: BuiltinWorkflowTier
  /** Library pack id; undefined for core/system. */
  packId?: string
  activation: BuiltinWorkflowActivation
  autoPolicy: BuiltinWorkflowAutoPolicy
  /** Presentation-only label; must not be persisted as the workflow key. */
  displayName?: string
  /** Lower sorts earlier within its tier; undefined sorts after ranked entries. */
  displayRank?: number
  /** Short human-language label explaining why a workflow is in Library/System. */
  tierReason?: string
  lifecycle?: BuiltinWorkflowLifecycle
  /** Internal workflow name of the recommended successor when lifecycle is deprecated. */
  successorName?: string
}

/**
 * Per-workflow library overlay (display, lifecycle, pack sort). Single table until YAML manifest
 * loader lands (design §4.2 / §15.4).
 */
export const LIBRARY_WORKFLOW_OVERLAYS: Readonly<
  Record<string, Partial<Omit<BuiltinWorkflowTierMeta, 'name' | 'tier'>>>
> = {
  'default-mini': {
    displayName: 'Standard Implement (mini)',
    tierReason: 'Shorter variant of default',
  },
  draft: {
    lifecycle: 'deprecated',
    successorName: 'minimal',
  },
  'default-draft': {
    lifecycle: 'deprecated',
    successorName: 'default',
  },
  'compound-eye': {
    lifecycle: 'deprecated',
  },
  'audit-unit': {
    displayRank: 10,
  },
  'review-fix-default': {
    displayRank: 10,
  },
}

interface CoreBuiltinWorkflow {
  name: string
  displayName: string
  displayRank: number
}

interface LibraryPack {
  id: string
  tierReason: string
  /**
   * Irregular member names that cannot be derived from {@link PACK_PREFIX_RULES}.
   * Prefix-derivable families (review-/audit-/cqrs/mini/takt-default) are NOT listed here;
   * the prefix rules are their single source of truth (design §15.2).
   */
  workflows: readonly string[]
}

/** Builtin workflows shown by default in the picker and seeded into auto routing. */
export const CORE_BUILTIN_WORKFLOWS: readonly CoreBuiltinWorkflow[] = [
  { name: 'minimal', displayName: 'Quick Implement', displayRank: 10 },
  { name: 'default', displayName: 'Standard Implement', displayRank: 20 },
  { name: 'default-high', displayName: 'Thorough Implement', displayRank: 30 },
  { name: 'frontend', displayName: 'Frontend Build', displayRank: 40 },
  { name: 'backend', displayName: 'Backend Build', displayRank: 50 },
  { name: 'dual', displayName: 'Full Stack Build', displayRank: 60 },
  { name: 'research', displayName: 'Research', displayRank: 70 },
  { name: 'deep-research', displayName: 'Deep Research', displayRank: 80 },
  { name: 'review-default', displayName: 'Review Changes', displayRank: 90 },
  { name: 'spec-driven', displayName: 'Spec Driven Build', displayRank: 100 },
]

const CORE_BY_NAME = new Map<string, CoreBuiltinWorkflow>(
  CORE_BUILTIN_WORKFLOWS.map((entry) => [entry.name, entry]),
)

/**
 * Library packs. `workflows` lists only irregular members; prefix-derivable families come from
 * {@link PACK_PREFIX_RULES}. A pack may declare no explicit members when its membership is fully
 * prefix-driven (e.g. `review-and-fix`, `audit`).
 */
export const LIBRARY_PACKS: readonly LibraryPack[] = [
  { id: 'mini-variants', tierReason: 'Lightweight variants', workflows: [] },
  { id: 'backend-advanced', tierReason: 'CQRS / high-structure backend', workflows: [] },
  { id: 'fullstack-advanced', tierReason: 'Composite full-stack', workflows: [] },
  {
    id: 'frontend-maintenance',
    tierReason: 'Maintenance, mocks & refactor',
    workflows: ['frontend-maintenance', 'frontend-refactor-mock'],
  },
  { id: 'review-and-fix', tierReason: 'Specialized review / fix', workflows: [] },
  { id: 'audit', tierReason: 'Audit only', workflows: [] },
  { id: 'infra', tierReason: 'IaC / infra', workflows: ['terraform'] },
  {
    id: 'takt-dev',
    tierReason: 'takt / Planetz development',
    // review-takt-default would otherwise match the `review-` prefix rule, so it is explicit here.
    workflows: ['review-takt-default', 'review-fix-takt-default', 'auto-improvement-loop'],
  },
  {
    id: 'experimental',
    tierReason: 'Experimental / validation',
    workflows: [
      'draft',
      'default-draft',
      'magi',
      'compound-eye',
      'peer-review',
      'default-peer-review',
    ],
  },
]

/**
 * Single source of truth for prefix-derivable pack membership. Order matters: earlier rules win,
 * and the dual-cqrs rule precedes the generic cqrs rule. Every `packId` must exist in
 * {@link LIBRARY_PACKS} (guarded by tests).
 */
export const PACK_PREFIX_RULES: ReadonlyArray<{ test: (name: string) => boolean; packId: string }> =
  [
    { test: (n) => /^review-/.test(n), packId: 'review-and-fix' },
    { test: (n) => /^audit-/.test(n), packId: 'audit' },
    { test: (n) => /^takt-default/.test(n), packId: 'takt-dev' },
    { test: (n) => /-cqrs(-mini)?$/.test(n) && n.startsWith('dual'), packId: 'fullstack-advanced' },
    { test: (n) => /-cqrs(-mini)?$/.test(n), packId: 'backend-advanced' },
    { test: (n) => /-mini$/.test(n), packId: 'mini-variants' },
  ]

const PACK_BY_WORKFLOW = new Map<string, LibraryPack>()
for (const pack of LIBRARY_PACKS) {
  for (const workflow of pack.workflows) {
    if (!PACK_BY_WORKFLOW.has(workflow)) PACK_BY_WORKFLOW.set(workflow, pack)
  }
}

const PACK_BY_ID = new Map<string, LibraryPack>(LIBRARY_PACKS.map((pack) => [pack.id, pack]))

/** Hidden builtins that stay selectable but never surface in the default picker. */
const SYSTEM_HIDDEN_EXTRA = new Set<string>(['ollama-chat'])

/** Tier reasons resolved from a single place so they stay consistent with pack reasons. */
const SYSTEM_TIER_REASON_CHAT = 'Chat only'
const SYSTEM_TIER_REASON_COMPAT = 'Local / compatibility'

/**
 * System tier: hidden from the default surface. Chat-only membership defers to
 * {@link isChatOnlyWorkflowName} (canonical) so the two never diverge (design §15.6).
 */
export function isSystemTierBuiltinWorkflow(name: string): boolean {
  const trimmed = name.trim()
  return isChatOnlyWorkflowName(trimmed) || SYSTEM_HIDDEN_EXTRA.has(trimmed)
}

export function isCoreBuiltinWorkflow(name: string): boolean {
  return CORE_BY_NAME.has(name.trim())
}

export function isLibraryBuiltinWorkflow(name: string): boolean {
  return resolveBuiltinWorkflowTier(name) === 'library'
}

function resolveDefaultLifecycle(packId: string | undefined): BuiltinWorkflowLifecycle {
  if (packId === 'experimental') return 'experimental'
  return 'active'
}

export function listCoreBuiltinWorkflowNames(): string[] {
  return CORE_BUILTIN_WORKFLOWS.map((entry) => entry.name)
}

/** Pack id from the prefix rules ({@link PACK_PREFIX_RULES}); undefined when no rule matches. */
function resolvePackByPrefix(name: string): string | undefined {
  return PACK_PREFIX_RULES.find((rule) => rule.test(name))?.packId
}

export function getLibraryPackId(name: string): string | undefined {
  const trimmed = name.trim()
  // Packs only apply to the library tier; core/system never carry a pack.
  if (resolveBuiltinWorkflowTier(trimmed) !== 'library') return undefined
  // Explicit irregular members win; everything else derives from prefix rules.
  return PACK_BY_WORKFLOW.get(trimmed)?.id ?? resolvePackByPrefix(trimmed)
}

export function resolveBuiltinWorkflowTier(name: string): BuiltinWorkflowTier {
  const trimmed = name.trim()
  if (isSystemTierBuiltinWorkflow(trimmed)) return 'system'
  if (CORE_BY_NAME.has(trimmed)) return 'core'
  return 'library'
}

function packTierReason(packId: string | undefined): string | undefined {
  if (!packId) return undefined
  return PACK_BY_ID.get(packId)?.tierReason
}

/**
 * Resolve the full tier overlay for a builtin workflow name. Tolerant: unknown names
 * resolve to the `library` tier so the catalog never breaks when the bundled set shifts.
 */
export function getBuiltinWorkflowTierMeta(name: string): BuiltinWorkflowTierMeta {
  const trimmed = name.trim()
  const tier = resolveBuiltinWorkflowTier(trimmed)

  if (tier === 'core') {
    const core = CORE_BY_NAME.get(trimmed)
    return {
      name: trimmed,
      tier,
      activation: 'always',
      autoPolicy: 'always',
      displayName: core?.displayName,
      displayRank: core?.displayRank,
    }
  }

  if (tier === 'system') {
    return {
      name: trimmed,
      tier,
      activation: 'hidden',
      autoPolicy: 'never',
      tierReason: isChatOnlyWorkflowName(trimmed)
        ? SYSTEM_TIER_REASON_CHAT
        : SYSTEM_TIER_REASON_COMPAT,
    }
  }

  const packId = getLibraryPackId(trimmed)
  const overlay = LIBRARY_WORKFLOW_OVERLAYS[trimmed]
  return {
    name: trimmed,
    tier,
    packId,
    activation: 'workspace-opt-in',
    autoPolicy: 'opt-in',
    tierReason: overlay?.tierReason ?? packTierReason(packId),
    displayName: overlay?.displayName,
    displayRank: overlay?.displayRank,
    lifecycle: overlay?.lifecycle ?? resolveDefaultLifecycle(packId),
    successorName: overlay?.successorName,
  }
}
