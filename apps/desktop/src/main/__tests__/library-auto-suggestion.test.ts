import {
  EMPTY_WORKFLOW_LIBRARY_PREFS,
  LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES,
  ROUTING_GROUPS,
  type TaskRoutingRequirements,
  type WorkflowRoutingAuditRecord,
  type WorkflowRoutingCatalog,
} from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  selectLibraryAutoSuggestionCandidateNames,
  suggestLibraryAutoEnablement,
} from '../session/workflow-auto/library-auto-suggestion.js'
import type { WorkflowAutoRouteContext } from '../session/workflow-auto/router.js'
import * as workflowFeatureIndex from '../session/workflow-auto/workflow-feature-index.js'
import { INVESTIGATE_ONLY_YAML } from './workflow-auto-test-fixtures.js'

const TERRAFORM_YAML = `name: terraform
initial_step: implement
steps:
  - name: implement
    edit: true
    persona: coder
    rules:
      - condition: done
        next: COMPLETE
`

const requirements: TaskRoutingRequirements = {
  intent: ['implement'],
  expectedOutput: ['code'],
  mayModifyCode: true,
  implementationAlreadyDecided: false,
  needsRootCauseAnalysis: false,
  needsTestWriting: false,
  needsDeepReview: false,
  targetSurfaces: ['general'],
  ambiguity: 'low',
  blockingUnknowns: [],
}

const catalog: WorkflowRoutingCatalog = {
  version: 1,
  groups: [...ROUTING_GROUPS],
  workflows: [
    { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
    { name: 'terraform', enabledForAuto: false, routingGroups: ['ops'] },
  ],
}

const auditBase: WorkflowRoutingAuditRecord = {
  version: 1,
  at: new Date().toISOString(),
  taskRequirements: requirements,
  candidatePool: [
    {
      workflow: 'default',
      score: 0.05,
      rejected: false,
      rejectReasons: [],
      matchedFeatures: [],
      featureSnapshot: {
        forcesImplementationOnAllPaths: false,
        canCompleteWithoutEditing: false,
        canCompleteBeforeFirstEdit: true,
        hasImplementationPath: true,
        changeMode: 'mixed',
        hasWriteTestsStep: false,
        dominantModes: ['implement'],
      },
    },
  ],
  selectedWorkflow: 'default',
  confidence: 'medium',
  decisionReason: '',
  comparedDifferences: [],
}

describe('suggestLibraryAutoEnablement', () => {
  const workflowsByName = new Map([
    ['default', 'builtin' as const],
    ['terraform', 'builtin' as const],
  ])

  const ctx: WorkflowAutoRouteContext = {
    cwd: '/tmp',
    engineConfig: { provider: 'cursor', model: 'auto' },
    resolveWorkflowYaml: async (name) => {
      if (name === 'terraform') return { yaml: TERRAFORM_YAML, source: 'builtin' }
      if (name === 'default') return { yaml: INVESTIGATE_ONLY_YAML, source: 'builtin' }
      return null
    },
  }

  it('suggests terraform for infra prompts when core fit is weak', async () => {
    const suggestion = await suggestLibraryAutoEnablement({
      prompt: 'provision terraform stack for staging',
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium',
        score: 0.05,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      audit: auditBase,
      catalog,
      availableWorkflowNames: ['default', 'terraform'],
      workflowsByName,
      uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
      requirements,
      ctx,
    })

    expect(suggestion?.workflowName).toBe('terraform')
  })

  it('returns undefined when prompt has no library keywords', async () => {
    const suggestion = await suggestLibraryAutoEnablement({
      prompt: 'fix the login button styling',
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium',
        score: 0.05,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      audit: auditBase,
      catalog,
      availableWorkflowNames: ['default', 'terraform'],
      workflowsByName,
      uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
      requirements,
      ctx,
    })

    expect(suggestion).toBeUndefined()
  })

  it('returns undefined when core confidence is high', async () => {
    const suggestion = await suggestLibraryAutoEnablement({
      prompt: 'provision terraform stack for staging',
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'high',
        score: 0.95,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      audit: auditBase,
      catalog,
      availableWorkflowNames: ['default', 'terraform'],
      workflowsByName,
      uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
      requirements,
      ctx,
    })

    expect(suggestion).toBeUndefined()
  })

  it('selectLibraryAutoSuggestionCandidateNames returns only keyword-matched library workflows', () => {
    const workflowsByName = new Map([
      ['default', 'builtin' as const],
      ['terraform', 'builtin' as const],
      ['audit-unit', 'builtin' as const],
    ])
    const names = selectLibraryAutoSuggestionCandidateNames({
      prompt: 'run audit on auth module',
      availableWorkflowNames: ['default', 'terraform', 'audit-unit'],
      workflowsByName,
      uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
    })
    expect(names).toEqual(['audit-unit'])
    expect(names.length).toBeLessThanOrEqual(LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES)
  })

  it('caps feature index resolution to LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES workflows', async () => {
    const buildSpy = vi.spyOn(workflowFeatureIndex, 'buildWorkflowFeatureIndex')
    const auditNames = [
      'audit-unit',
      'audit-e2e',
      'audit-security',
      ...Array.from(
        { length: LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES },
        (_, i) => `audit-filler-${i}`,
      ),
    ]
    const workflowsByName = new Map(auditNames.map((name) => [name, 'builtin' as const]))

    await suggestLibraryAutoEnablement({
      prompt: 'please audit the codebase',
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium',
        score: 0.05,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      audit: auditBase,
      catalog: {
        ...catalog,
        workflows: [
          ...catalog.workflows,
          ...auditNames.map((name) => ({
            name,
            enabledForAuto: false,
            routingGroups: ['general' as const],
          })),
        ],
      },
      availableWorkflowNames: ['default', ...auditNames],
      workflowsByName,
      uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
      requirements,
      ctx: {
        ...ctx,
        resolveWorkflowYaml: async (name) => {
          if (name.startsWith('audit')) return { yaml: INVESTIGATE_ONLY_YAML, source: 'builtin' }
          return ctx.resolveWorkflowYaml(name)
        },
      },
    })

    expect(buildSpy).toHaveBeenCalled()
    const resolvedNames = buildSpy.mock.calls[0]?.[0] ?? []
    expect(resolvedNames.length).toBeLessThanOrEqual(LIBRARY_AUTO_SUGGESTION_MAX_CANDIDATES)
    buildSpy.mockRestore()
  })
})
