import {
  ROUTING_GROUPS,
  ROUTING_REASON_CODES,
  SPEC_DRIVEN_WORKFLOW_NAME,
  type WorkflowRoutingCatalog,
  type WorkflowStructureFeatures,
} from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import { buildScoredRoutingCandidates } from '../session/workflow-auto/candidate-builder.js'
import { extractWorkflowStructureFeatures } from '../session/workflow-auto/workflow-feature-extractor.js'
import type { WorkflowYamlResolver } from '../session/workflow-auto/workflow-yaml-resolver.js'
import {
  highComplexityFeatureTask,
  IMPLEMENT_HEAVY_YAML,
  INVESTIGATE_ONLY_YAML,
  lowComplexityImplementTask,
  MIXED_COMPLETION_PATHS_YAML,
  minimalFeatures,
} from './workflow-auto-test-fixtures.js'

const catalog: WorkflowRoutingCatalog = {
  version: 1,
  groups: [...ROUTING_GROUPS],
  workflows: [
    { name: 'investigate-only', enabledForAuto: true, routingGroups: ['research'] },
    { name: 'implement-heavy', enabledForAuto: true, routingGroups: ['feature'] },
    { name: 'mixed-paths', enabledForAuto: true, routingGroups: ['general'] },
  ],
}

const resolver: WorkflowYamlResolver = async (name) => {
  if (name === 'investigate-only') return { yaml: INVESTIGATE_ONLY_YAML, source: 'builtin' }
  if (name === 'implement-heavy') return { yaml: IMPLEMENT_HEAVY_YAML, source: 'builtin' }
  if (name === 'mixed-paths') return { yaml: MIXED_COMPLETION_PATHS_YAML, source: 'builtin' }
  return null
}

describe('buildScoredRoutingCandidates', () => {
  it('rejects implement-heavy for undecided investigate tasks', async () => {
    const featuresByName = new Map()
    for (const name of ['investigate-only', 'implement-heavy']) {
      const features = await extractWorkflowStructureFeatures(name, resolver)
      if (features) featuresByName.set(name, features)
    }

    const scored = buildScoredRoutingCandidates({
      catalog,
      featuresByName,
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
      availableWorkflowNames: ['investigate-only', 'implement-heavy'],
    })

    const heavy = scored.find((c) => c.workflowName === 'implement-heavy')
    expect(heavy?.rejected).toBe(true)
    const investigate = scored.find((c) => c.workflowName === 'investigate-only')
    expect(investigate?.rejected).toBe(false)
  })

  it('rejects mixed-path workflow for investigate report tasks via feature extraction', async () => {
    const featuresByName = new Map()
    for (const name of ['investigate-only', 'mixed-paths']) {
      const features = await extractWorkflowStructureFeatures(name, resolver)
      if (features) featuresByName.set(name, features)
    }

    const scored = buildScoredRoutingCandidates({
      catalog: {
        ...catalog,
        workflows: catalog.workflows.filter((w) => w.name !== 'implement-heavy'),
      },
      featuresByName,
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
      availableWorkflowNames: ['investigate-only', 'mixed-paths'],
    })

    const mixed = scored.find((c) => c.workflowName === 'mixed-paths')
    expect(mixed?.rejected).toBe(true)
    expect(mixed?.rejectReasons).toContain(ROUTING_REASON_CODES.reject.reportOutputMismatch)
    const investigate = scored.find((c) => c.workflowName === 'investigate-only')
    expect(investigate?.rejected).toBe(false)
    expect(investigate?.score).toBeGreaterThan(mixed?.score ?? 0)
  })

  it('prefers lighter workflow for simple tasks when scores are close', () => {
    const shared: Partial<WorkflowStructureFeatures> = {
      forcesImplementationOnAllPaths: false,
      canCompleteWithoutEditing: false,
      hasImplementationPath: true,
      changeMode: 'mixed',
      primaryOutputs: ['code'],
      dominantModes: ['implement'],
      editStepCount: 1,
    }
    const scored = buildScoredRoutingCandidates({
      catalog: {
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          { name: 'light-flow', enabledForAuto: true, routingGroups: ['feature'] },
          { name: 'heavy-flow', enabledForAuto: true, routingGroups: ['feature'] },
        ],
      },
      featuresByName: new Map([
        ['light-flow', minimalFeatures('light-flow', { ...shared, stepCount: 3 })],
        ['heavy-flow', minimalFeatures('heavy-flow', { ...shared, stepCount: 20 })],
      ]),
      requirements: lowComplexityImplementTask,
      availableWorkflowNames: ['light-flow', 'heavy-flow'],
    })

    const viable = scored.filter((c) => !c.rejected)
    expect(viable[0]?.workflowName).toBe('light-flow')
    expect(viable[0]?.matchedFeatures).toContain(
      ROUTING_REASON_CODES.match.complexityPreferLightweight,
    )
  })

  it('keeps heavier workflow first for complex tasks when it scores higher', () => {
    const scored = buildScoredRoutingCandidates({
      catalog: {
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          { name: 'light-flow', enabledForAuto: true, routingGroups: ['feature'] },
          { name: 'heavy-flow', enabledForAuto: true, routingGroups: ['feature'] },
        ],
      },
      featuresByName: new Map([
        [
          'light-flow',
          minimalFeatures('light-flow', {
            stepCount: 3,
            editStepCount: 1,
            forcesImplementationOnAllPaths: false,
            hasImplementationPath: true,
            changeMode: 'mixed',
            primaryOutputs: ['code'],
            dominantModes: ['implement'],
          }),
        ],
        [
          'heavy-flow',
          minimalFeatures('heavy-flow', {
            stepCount: 20,
            editStepCount: 10,
            forcesImplementationOnAllPaths: false,
            hasImplementationPath: true,
            hasWriteTestsStep: true,
            hasReviewLoop: true,
            changeMode: 'edit_heavy',
            primaryOutputs: ['code', 'tests', 'review-findings'],
            dominantModes: ['implement', 'review'],
          }),
        ],
      ]),
      requirements: {
        intent: ['implement', 'review'],
        expectedOutput: ['code', 'review-findings', 'tests'],
        mayModifyCode: true,
        implementationAlreadyDecided: true,
        needsRootCauseAnalysis: true,
        needsTestWriting: true,
        needsDeepReview: true,
        targetSurfaces: ['general'],
        ambiguity: 'high',
        blockingUnknowns: ['scope'],
      },
      availableWorkflowNames: ['light-flow', 'heavy-flow'],
    })

    const viable = scored.filter((c) => !c.rejected)
    expect(viable[0]?.workflowName).toBe('heavy-flow')
  })

  it('rejects spec-driven for low-complexity tasks via complexityBand metadata', () => {
    const scored = buildScoredRoutingCandidates({
      catalog: {
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          {
            name: SPEC_DRIVEN_WORKFLOW_NAME,
            enabledForAuto: true,
            routingGroups: ['feature'],
            complexityBand: 'high',
            safetyTier: 'safe',
          },
          { name: 'default', enabledForAuto: true, routingGroups: ['general'] },
        ],
      },
      featuresByName: new Map([
        [
          SPEC_DRIVEN_WORKFLOW_NAME,
          minimalFeatures(SPEC_DRIVEN_WORKFLOW_NAME, {
            primaryOutputs: ['report', 'code'],
            forcesImplementationOnAllPaths: false,
            changeMode: 'mixed',
            stepCount: 12,
          }),
        ],
        [
          'default',
          minimalFeatures('default', {
            stepCount: 4,
            forcesImplementationOnAllPaths: false,
            changeMode: 'mixed',
          }),
        ],
      ]),
      requirements: lowComplexityImplementTask,
      availableWorkflowNames: [SPEC_DRIVEN_WORKFLOW_NAME, 'default'],
    })

    const specDriven = scored.find((c) => c.workflowName === SPEC_DRIVEN_WORKFLOW_NAME)
    expect(specDriven?.rejected).toBe(true)
    expect(specDriven?.rejectReasons).toContain(
      ROUTING_REASON_CODES.reject.highComplexityBandForSimpleTask,
    )
  })

  it('keeps spec-driven viable for high-complexity implement tasks', () => {
    const scored = buildScoredRoutingCandidates({
      catalog: {
        version: 1,
        groups: [...ROUTING_GROUPS],
        workflows: [
          {
            name: SPEC_DRIVEN_WORKFLOW_NAME,
            enabledForAuto: true,
            routingGroups: ['feature'],
            complexityBand: 'high',
            safetyTier: 'safe',
          },
        ],
      },
      featuresByName: new Map([
        [
          SPEC_DRIVEN_WORKFLOW_NAME,
          minimalFeatures(SPEC_DRIVEN_WORKFLOW_NAME, {
            primaryOutputs: ['report', 'code'],
            forcesImplementationOnAllPaths: false,
            canCompleteWithoutEditing: true,
            changeMode: 'mixed',
            hasImplementationPath: true,
            stepCount: 12,
            dominantModes: ['investigate', 'implement'],
          }),
        ],
      ]),
      requirements: {
        ...highComplexityFeatureTask,
        targetSurfaces: ['frontend'],
        blockingUnknowns: ['acceptance criteria unclear'],
      },
      availableWorkflowNames: [SPEC_DRIVEN_WORKFLOW_NAME],
    })

    const specDriven = scored.find((c) => c.workflowName === SPEC_DRIVEN_WORKFLOW_NAME)
    expect(specDriven?.rejected).toBe(false)
  })

  it('includes enabled workflows with missing features as rejected', () => {
    const scored = buildScoredRoutingCandidates({
      catalog: {
        ...catalog,
        workflows: [
          ...catalog.workflows,
          { name: 'missing-yaml', enabledForAuto: true, routingGroups: ['general'] },
        ],
      },
      featuresByName: new Map(),
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
      availableWorkflowNames: ['investigate-only', 'implement-heavy', 'missing-yaml'],
    })

    const missing = scored.find((c) => c.workflowName === 'missing-yaml')
    expect(missing?.rejected).toBe(true)
    expect(missing?.rejectReasons).toContain(ROUTING_REASON_CODES.reject.featuresUnavailable)
  })
})
