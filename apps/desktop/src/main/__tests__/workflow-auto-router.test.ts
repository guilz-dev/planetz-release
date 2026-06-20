import {
  EMPTY_WORKFLOW_LIBRARY_PREFS,
  ROUTING_GROUPS,
  type WorkflowRoutingCatalog,
} from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { ComposerLlmTimeoutError } from '../planetz/composer-llm-client.js'
import * as llmClient from '../session/workflow-auto/llm-client.js'
import {
  routeWorkflowAuto,
  routeWorkflowAutoDeterministic,
} from '../session/workflow-auto/router.js'
import { selectedWorkflowViolatesHardRejectPool } from '../session/workflow-auto/routing-audit-guards.js'
import type { WorkflowYamlResolver } from '../session/workflow-auto/workflow-yaml-resolver.js'
import {
  IMPLEMENT_HEAVY_YAML,
  INVESTIGATE_ONLY_YAML,
  MIXED_COMPLETION_PATHS_YAML,
} from './workflow-auto-test-fixtures.js'

const catalog: WorkflowRoutingCatalog = {
  version: 1,
  groups: [...ROUTING_GROUPS],
  workflows: [
    {
      name: 'bugfix-flow',
      enabledForAuto: true,
      routingGroups: ['bugfix'],
    },
    {
      name: 'default',
      enabledForAuto: true,
      routingGroups: ['general'],
    },
  ],
}

function createResolver(yamlByName: Record<string, string>): WorkflowYamlResolver {
  return async (name) => {
    const yaml = yamlByName[name]
    return yaml ? { yaml, source: 'builtin' as const } : null
  }
}

const baseCtx = {
  cwd: '/tmp/repo',
  engineConfig: { provider: 'cursor', model: 'auto' },
  resolveWorkflowYaml: createResolver({
    'bugfix-flow': IMPLEMENT_HEAVY_YAML,
    default: INVESTIGATE_ONLY_YAML,
  }),
}

function mockLlmRounds(rounds: {
  requirements?: Record<string, unknown>
  final?: Record<string, unknown>
}) {
  let calls = 0
  return vi.spyOn(llmClient, 'callWorkflowAutoRoutingLlmJson').mockImplementation(async (input) => {
    calls += 1
    const payload =
      calls === 1
        ? (rounds.requirements ?? {
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'low',
            blockingUnknowns: [],
          })
        : (rounds.final ?? {
            selectedWorkflow: 'bugfix-flow',
            confidence: 'high',
            decisionReason: 'best fit',
            comparedDifferences: [],
          })
    return input.parse(JSON.stringify(payload))
  })
}

describe('routeWorkflowAuto', () => {
  it('uses final LLM selection when response is valid', async () => {
    mockLlmRounds({})

    const routed = await routeWorkflowAuto(
      {
        prompt: 'fix login bug',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      baseCtx,
    )

    expect(routed.decision.selectedWorkflow).toBe('bugfix-flow')
    expect(routed.decision.fallbackApplied).toBe(false)
    expect(routed.audit.selectedWorkflow).toBe('bugfix-flow')
    expect(routed.audit.candidatePool.length).toBeGreaterThan(0)
  })

  it('skips final LLM when only one viable non-strict candidate', async () => {
    const llmSpy = vi.spyOn(llmClient, 'callWorkflowAutoRoutingLlmJson')
    const singleCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'only-flow',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    }

    const routed = await routeWorkflowAuto(
      {
        prompt: 'do something',
        catalog: singleCatalog,
        availableWorkflowNames: ['only-flow'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({ 'only-flow': INVESTIGATE_ONLY_YAML }),
      },
    )

    const finalCalls = llmSpy.mock.calls.filter((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCalls).toHaveLength(0)
    expect(routed.decision.selectedWorkflow).toBe('only-flow')
    expect(routed.decision.fallbackApplied).toBe(false)
  })

  it('falls back when provider is unresolved', async () => {
    const llmSpy = vi.spyOn(llmClient, 'callWorkflowAutoRoutingLlmJson')
    const routed = await routeWorkflowAuto(
      {
        prompt: 'fix login bug',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      { ...baseCtx, engineConfig: {} },
    )

    const finalCalls = llmSpy.mock.calls.filter((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCalls).toHaveLength(0)
    expect(routed.decision.fallbackApplied).toBe(true)
  })

  it('falls back on final LLM invalid JSON', async () => {
    let calls = 0
    vi.spyOn(llmClient, 'callWorkflowAutoRoutingLlmJson').mockImplementation(async (input) => {
      calls += 1
      if (calls === 1) {
        return input.parse(
          JSON.stringify({
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'high',
            blockingUnknowns: [],
          }),
        )
      }
      throw new SyntaxError('Unexpected token')
    })

    const routed = await routeWorkflowAuto(
      {
        prompt: 'fix login bug',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      baseCtx,
    )

    expect(routed.decision.fallbackApplied).toBe(true)
    expect(routed.decision.llm?.failureCode).toBe('invalid-json')
  })

  it('calls final LLM for a single strict candidate', async () => {
    const llmSpy = mockLlmRounds({
      final: {
        selectedWorkflow: 'strict-only',
        confidence: 'high',
        decisionReason: 'strict',
        comparedDifferences: [],
      },
    })
    const strictCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'strict-only',
          enabledForAuto: true,
          routingGroups: ['bugfix'],
          safetyTier: 'strict',
        },
      ],
    }

    await routeWorkflowAuto(
      {
        prompt: 'fix critical production bug',
        catalog: strictCatalog,
        availableWorkflowNames: ['strict-only'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({ 'strict-only': IMPLEMENT_HEAVY_YAML }),
      },
    )

    const finalCalls = llmSpy.mock.calls.filter((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCalls.length).toBeGreaterThan(0)
  })

  it('sends deterministic summary fields to final compare prompt', async () => {
    const llmSpy = mockLlmRounds({
      final: {
        selectedWorkflow: 'strict-only',
        confidence: 'high',
        decisionReason: 'strict override',
        comparedDifferences: [],
      },
    })
    const strictCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'strict-only',
          enabledForAuto: true,
          routingGroups: ['bugfix'],
          safetyTier: 'strict',
        },
      ],
    }

    await routeWorkflowAuto(
      {
        prompt: 'fix critical production bug',
        catalog: strictCatalog,
        availableWorkflowNames: ['strict-only'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({ 'strict-only': IMPLEMENT_HEAVY_YAML }),
      },
    )

    const finalCall = llmSpy.mock.calls.find((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCall).toBeDefined()
    expect(String(finalCall?.[0].prompt)).toContain('deterministicRank')
    expect(String(finalCall?.[0].prompt)).toContain('shortReason')
  })

  it('short-circuits final compare when deterministic gap is wide', async () => {
    const llmSpy = mockLlmRounds({})
    const deterministicCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        { name: 'implement-heavy', enabledForAuto: true, routingGroups: ['feature'] },
        { name: 'investigate-only', enabledForAuto: true, routingGroups: ['research'] },
      ],
    }

    const routed = await routeWorkflowAuto(
      {
        prompt: 'implement the fix and add tests',
        catalog: deterministicCatalog,
        availableWorkflowNames: ['implement-heavy', 'investigate-only'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({
          'implement-heavy': IMPLEMENT_HEAVY_YAML,
          'investigate-only': INVESTIGATE_ONLY_YAML,
        }),
      },
    )

    const finalCalls = llmSpy.mock.calls.filter((call) =>
      String(call[0].systemPrompt).includes('fixed candidate list'),
    )
    expect(finalCalls).toHaveLength(0)
    expect(routed.decision.reasonCodes).toContain('routing:deterministic-short-circuit')
    expect(routed.decision.selectedWorkflow).toBe('implement-heavy')
  })

  it('falls back on timeout', async () => {
    let calls = 0
    vi.spyOn(llmClient, 'callWorkflowAutoRoutingLlmJson').mockImplementation(async (input) => {
      calls += 1
      if (calls === 1) {
        return input.parse(
          JSON.stringify({
            intent: ['implement'],
            expectedOutput: ['code'],
            mayModifyCode: true,
            implementationAlreadyDecided: true,
            needsRootCauseAnalysis: false,
            needsTestWriting: false,
            needsDeepReview: false,
            targetSurfaces: ['general'],
            ambiguity: 'high',
            blockingUnknowns: [],
          }),
        )
      }
      throw new ComposerLlmTimeoutError()
    })

    const routed = await routeWorkflowAuto(
      {
        prompt: 'fix login bug',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      baseCtx,
    )

    expect(routed.decision.fallbackApplied).toBe(true)
    expect(routed.decision.llm?.failureCode).toBe('timeout')
  })

  it('falls back on empty prompt without calling routing LLM', async () => {
    const llmSpy = vi.spyOn(llmClient, 'callWorkflowAutoRoutingLlmJson')
    const routed = await routeWorkflowAuto(
      {
        prompt: '   ',
        catalog,
        availableWorkflowNames: ['default'],
      },
      baseCtx,
    )

    expect(llmSpy).not.toHaveBeenCalled()
    expect(routed.decision.fallbackApplied).toBe(true)
    expect(routed.audit.candidatePool).toHaveLength(0)
  })

  it('rejects investigate task against all-paths implement workflow', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: false,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: true,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'medium',
        blockingUnknowns: [],
      },
      final: {
        selectedWorkflow: 'default',
        confidence: 'high',
        decisionReason: 'report path',
        comparedDifferences: [],
      },
    })

    const routed = await routeWorkflowAuto(
      {
        prompt: 'investigate why login fails before changing code',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      baseCtx,
    )

    const bugfixPool = routed.audit.candidatePool.find((c) => c.workflow === 'bugfix-flow')
    expect(bugfixPool?.rejected).toBe(true)
    expect(bugfixPool?.rejectReasons.length).toBeGreaterThan(0)
  })

  it('does not re-select a hard-rejected workflow when all candidates are rejected', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: false,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: true,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'medium',
        blockingUnknowns: [],
      },
    })

    const implementOnlyCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'implement-only',
          enabledForAuto: true,
          routingGroups: ['bugfix'],
        },
      ],
    }

    const routed = await routeWorkflowAuto(
      {
        prompt: 'investigate why login fails before changing code',
        catalog: implementOnlyCatalog,
        availableWorkflowNames: ['implement-only', 'default'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({
          'implement-only': IMPLEMENT_HEAVY_YAML,
          default: INVESTIGATE_ONLY_YAML,
        }),
      },
    )

    const implementPool = routed.audit.candidatePool.find((c) => c.workflow === 'implement-only')
    expect(implementPool?.rejected).toBe(true)
    expect(routed.audit.candidatePool.every((c) => c.rejected)).toBe(true)
    expect(routed.decision.fallbackApplied).toBe(true)
    expect(routed.decision.selectedWorkflow).toBe('default')
    expect(routed.decision.selectedWorkflow).not.toBe('implement-only')
    expect(routed.decision.reasonCodes).toContain('fallback:all-rejected')
    expect(selectedWorkflowViolatesHardRejectPool(routed.audit)).toBe(false)
  })

  it('falls back to default when only rejected workflows are available', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: false,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: true,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'medium',
        blockingUnknowns: [],
      },
    })

    const implementOnlyCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'implement-only',
          enabledForAuto: true,
          routingGroups: ['bugfix'],
        },
      ],
    }

    const routed = await routeWorkflowAuto(
      {
        prompt: 'investigate why login fails before changing code',
        catalog: implementOnlyCatalog,
        availableWorkflowNames: ['implement-only'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({ 'implement-only': IMPLEMENT_HEAVY_YAML }),
      },
    )

    expect(routed.audit.candidatePool.every((c) => c.rejected)).toBe(true)
    expect(routed.decision.selectedWorkflow).toBe('default')
    expect(routed.decision.selectedWorkflow).not.toBe('implement-only')
    expect(selectedWorkflowViolatesHardRejectPool(routed.audit)).toBe(false)
  })
})

describe('routeWorkflowAuto runtime library eligibility', () => {
  const libraryCatalog: WorkflowRoutingCatalog = {
    version: 1,
    groups: [...ROUTING_GROUPS],
    workflows: [
      { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
      { name: 'terraform', enabledForAuto: false, routingGroups: ['ops'] },
    ],
  }

  const workflowsByName = new Map([
    ['default', 'builtin' as const],
    ['terraform', 'builtin' as const],
  ])

  const resolver = createResolver({
    default: INVESTIGATE_ONLY_YAML,
    terraform: IMPLEMENT_HEAVY_YAML,
  })

  it('excludes library builtin from pool unless autoEnabledWorkflows lists it', async () => {
    const withoutLibraryAuto = await routeWorkflowAutoDeterministic(
      {
        prompt: 'provision terraform stack for staging',
        catalog: libraryCatalog,
        availableWorkflowNames: ['default', 'terraform'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: resolver,
        runtimeAutoFilter: {
          workflowsByName,
          uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
        },
      },
    )

    const poolWithout = withoutLibraryAuto.audit.candidatePool.map((entry) => entry.workflow)
    expect(poolWithout).toContain('default')
    expect(poolWithout).not.toContain('terraform')

    const withLibraryAuto = await routeWorkflowAutoDeterministic(
      {
        prompt: 'provision terraform stack for staging',
        catalog: libraryCatalog,
        availableWorkflowNames: ['default', 'terraform'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: resolver,
        runtimeAutoFilter: {
          workflowsByName,
          uiPrefs: { ...EMPTY_WORKFLOW_LIBRARY_PREFS, autoEnabledWorkflows: ['terraform'] },
        },
      },
    )

    const poolWith = withLibraryAuto.audit.candidatePool.map((entry) => entry.workflow)
    expect(poolWith).toContain('terraform')
  })
})

describe('routeWorkflowAuto kiro phase gate', () => {
  it('rejects implement-heavy workflow when kiro tasks are not approved', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['implement'],
        expectedOutput: ['code'],
        mayModifyCode: true,
        implementationAlreadyDecided: true,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'low',
        blockingUnknowns: [],
      },
    })

    const routed = await routeWorkflowAuto(
      {
        prompt: 'implement billing module',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      {
        ...baseCtx,
        resolveKiroRoutingContext: async () => ({
          specFeatureId: 'billing',
          kiroPhase: 'tasks',
          phaseReason: 'billing: tasks not approved',
        }),
      },
    )

    expect(routed.audit.taskRequirements.implementationAlreadyDecided).toBe(false)
    expect(routed.audit.taskRequirements.kiroRouting?.kiroPhase).toBe('tasks')
    const bugfix = routed.audit.candidatePool.find((entry) => entry.workflow === 'bugfix-flow')
    expect(bugfix?.rejected).toBe(true)
    expect(bugfix?.rejectReasons).toContain('reject:kiro-phase-blocks-implementation')
    expect(routed.decision.selectedWorkflow).toBe('default')
  })

  it('rejects mixed implementation path when kiro tasks are not approved', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: true,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'low',
        blockingUnknowns: [],
      },
    })

    const mixedCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'mixed-paths',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
        {
          name: 'default',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    }

    const routed = await routeWorkflowAuto(
      {
        prompt: 'investigate billing requirements',
        catalog: mixedCatalog,
        availableWorkflowNames: ['mixed-paths', 'default'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({
          'mixed-paths': MIXED_COMPLETION_PATHS_YAML,
          default: INVESTIGATE_ONLY_YAML,
        }),
        resolveKiroRoutingContext: async () => ({
          specFeatureId: 'billing',
          kiroPhase: 'tasks',
          phaseReason: 'billing: tasks not approved',
        }),
      },
    )

    const mixed = routed.audit.candidatePool.find((entry) => entry.workflow === 'mixed-paths')
    expect(mixed?.rejected).toBe(true)
    expect(mixed?.rejectReasons).toContain('reject:kiro-phase-blocks-implementation')
    expect(routed.decision.selectedWorkflow).toBe('default')
  })

  it('rejects mixed implementation path when kiro design is not approved', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: true,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'low',
        blockingUnknowns: [],
      },
    })

    const mixedCatalog: WorkflowRoutingCatalog = {
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        {
          name: 'mixed-paths',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
        {
          name: 'default',
          enabledForAuto: true,
          routingGroups: ['general'],
        },
      ],
    }

    const routed = await routeWorkflowAuto(
      {
        prompt: 'investigate billing design',
        catalog: mixedCatalog,
        availableWorkflowNames: ['mixed-paths', 'default'],
      },
      {
        ...baseCtx,
        resolveWorkflowYaml: createResolver({
          'mixed-paths': MIXED_COMPLETION_PATHS_YAML,
          default: INVESTIGATE_ONLY_YAML,
        }),
        resolveKiroRoutingContext: async () => ({
          specFeatureId: 'billing',
          kiroPhase: 'design',
          phaseReason: 'billing: design not approved',
        }),
      },
    )

    const mixed = routed.audit.candidatePool.find((entry) => entry.workflow === 'mixed-paths')
    expect(mixed?.rejected).toBe(true)
    expect(mixed?.rejectReasons).toContain('reject:kiro-phase-blocks-implementation')
    expect(routed.decision.selectedWorkflow).toBe('default')
  })

  it('prefers investigate-only workflow when kiro requirements are not approved', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['investigate'],
        expectedOutput: ['report'],
        mayModifyCode: true,
        implementationAlreadyDecided: false,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'low',
        blockingUnknowns: [],
      },
    })

    const routed = await routeWorkflowAuto(
      {
        prompt: 'investigate billing requirements',
        catalog,
        availableWorkflowNames: ['bugfix-flow', 'default'],
      },
      {
        ...baseCtx,
        resolveKiroRoutingContext: async () => ({
          specFeatureId: 'billing',
          kiroPhase: 'requirements',
          phaseReason: 'billing: requirements not approved',
        }),
      },
    )

    expect(routed.audit.taskRequirements.implementationAlreadyDecided).toBe(false)
    expect(routed.audit.taskRequirements.kiroRouting?.kiroPhase).toBe('requirements')
    expect(routed.decision.selectedWorkflow).toBe('default')
    const defaultCandidate = routed.audit.candidatePool.find(
      (entry) => entry.workflow === 'default',
    )
    expect(defaultCandidate?.matchedFeatures).toContain('match:kiro-spec-phase')
  })

  it('routes identically when kiro context hook is absent or null', async () => {
    mockLlmRounds({
      requirements: {
        intent: ['implement'],
        expectedOutput: ['code'],
        mayModifyCode: true,
        implementationAlreadyDecided: true,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'low',
        blockingUnknowns: [],
      },
    })

    const routeInput = {
      prompt: 'implement login fix',
      catalog,
      availableWorkflowNames: ['bugfix-flow', 'default'],
    }

    const withoutHook = await routeWorkflowAutoDeterministic(routeInput, baseCtx)
    const withNullCtx = await routeWorkflowAutoDeterministic(routeInput, {
      ...baseCtx,
      resolveKiroRoutingContext: async () => null,
    })

    expect(withoutHook.decision.selectedWorkflow).toBe(withNullCtx.decision.selectedWorkflow)
    expect(withoutHook.audit.taskRequirements.kiroRouting).toBeUndefined()
    expect(withNullCtx.audit.taskRequirements.kiroRouting).toBeUndefined()
  })
})
