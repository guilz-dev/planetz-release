import {
  EMPTY_WORKFLOW_LIBRARY_PREFS,
  ROUTING_GROUPS,
  type TaskRoutingRequirements,
  type WorkflowRoutingAuditRecord,
} from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import * as libraryAutoSuggestion from '../session/workflow-auto/library-auto-suggestion.js'
import * as router from '../session/workflow-auto/router.js'
import { WorkflowPreviewCache } from '../session/workflow-selection/workflow-preview-cache.js'
import { previewWorkflowAutoRoute } from '../session/workflow-selection/workflow-preview-service.js'

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

const audit: WorkflowRoutingAuditRecord = {
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

describe('previewWorkflowAutoRoute', () => {
  const previewCache = new WorkflowPreviewCache()

  const baseDeps = {
    readWorkflowDocument: vi.fn(),
    loadWorkflowRoutingCatalog: vi.fn(async () => ({
      version: 1,
      groups: [...ROUTING_GROUPS],
      workflows: [
        { name: 'default', enabledForAuto: true, routingGroups: ['general' as const] },
        { name: 'terraform', enabledForAuto: false, routingGroups: ['ops' as const] },
      ],
    })),
    listAvailableWorkflowNames: vi.fn(async () => ['default', 'terraform']),
    buildAutoRouteContext: vi.fn(async () => ({
      cwd: '/tmp',
      engineConfig: { provider: 'cursor', model: 'auto' },
      resolveWorkflowYaml: async () => null,
      runtimeAutoFilter: {
        workflowsByName: new Map([
          ['default', 'builtin' as const],
          ['terraform', 'builtin' as const],
        ]),
        uiPrefs: EMPTY_WORKFLOW_LIBRARY_PREFS,
      },
    })),
    previewCache,
  }

  it('attaches libraryAutoSuggestion on deterministic preview when suggestion is available', async () => {
    vi.spyOn(router, 'routeWorkflowAutoDeterministic').mockResolvedValue({
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium',
        score: 0.05,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      audit,
    })
    vi.spyOn(libraryAutoSuggestion, 'suggestLibraryAutoEnablement').mockResolvedValue({
      workflowName: 'terraform',
      score: 0.42,
      displayName: 'Terraform',
      packId: 'ops',
    })

    const result = await previewWorkflowAutoRoute(baseDeps, {
      body: 'provision terraform stack',
      phase: 'deterministic',
    })

    expect(result.libraryAutoSuggestion?.workflowName).toBe('terraform')
    expect(libraryAutoSuggestion.suggestLibraryAutoEnablement).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('skips libraryAutoSuggestion on full preview phase', async () => {
    const suggestSpy = vi.spyOn(libraryAutoSuggestion, 'suggestLibraryAutoEnablement')
    vi.spyOn(router, 'routeWorkflowAuto').mockResolvedValue({
      decision: {
        selectedWorkflow: 'default',
        group: 'general',
        confidence: 'medium',
        score: 0.05,
        fallbackApplied: false,
        alternatives: [],
        reasonCodes: [],
      },
      audit,
    })

    const result = await previewWorkflowAutoRoute(baseDeps, {
      body: 'provision terraform stack',
      phase: 'full',
    })

    expect(result.libraryAutoSuggestion).toBeUndefined()
    expect(suggestSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
