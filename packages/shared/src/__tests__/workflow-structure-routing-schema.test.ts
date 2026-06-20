import { describe, expect, it } from 'vitest'
import { redactRoutingAuditRecord } from '../redact-routing-audit.js'
import {
  finalSelectionCandidateSummarySchema,
  taskRoutingRequirementsSchema,
  toWorkflowFeatureSnapshot,
  workflowRoutingAuditRecordSchema,
  workflowStructureFeaturesSchema,
} from '../workflow-structure-routing-schema.js'

describe('workflowStructureFeaturesSchema', () => {
  it('parses minimal features', () => {
    const parsed = workflowStructureFeaturesSchema.parse({
      workflowName: 'default',
      source: 'builtin',
      canCompleteWithoutEditing: false,
      canCompleteBeforeFirstEdit: true,
      forcesImplementationOnAllPaths: false,
      hasImplementationPath: true,
      forcesTestWriting: true,
      requiresClearSpec: false,
      changeMode: 'mixed',
      primaryOutputs: ['code', 'tests'],
      dominantModes: ['implement'],
      targetSurfaces: ['general'],
      hasWriteTestsStep: true,
      hasReviewLoop: true,
      hasFixLoop: true,
      hasParallelReview: false,
      hasWorkflowCall: true,
      hasLoopMonitor: false,
      personaKeys: ['planner'],
      policyKeys: [],
      knowledgeKeys: [],
      instructionKeys: [],
      reportFormatKeys: [],
      stepCount: 4,
      editStepCount: 2,
      reviewStepCount: 1,
      investigateStepCount: 0,
      auditStepCount: 0,
      evidence: [],
    })
    expect(parsed.workflowName).toBe('default')
  })
})

describe('toWorkflowFeatureSnapshot', () => {
  it('copies key booleans for audit pool', () => {
    const features = workflowStructureFeaturesSchema.parse({
      workflowName: 'x',
      source: 'project',
      canCompleteWithoutEditing: true,
      canCompleteBeforeFirstEdit: true,
      forcesImplementationOnAllPaths: false,
      hasImplementationPath: false,
      forcesTestWriting: false,
      requiresClearSpec: false,
      changeMode: 'read_only',
      primaryOutputs: ['report'],
      dominantModes: ['investigate'],
      targetSurfaces: ['general'],
      hasWriteTestsStep: false,
      hasReviewLoop: false,
      hasFixLoop: false,
      hasParallelReview: false,
      hasWorkflowCall: false,
      hasLoopMonitor: false,
      personaKeys: [],
      policyKeys: [],
      knowledgeKeys: [],
      instructionKeys: [],
      reportFormatKeys: [],
      stepCount: 1,
      editStepCount: 0,
      reviewStepCount: 0,
      investigateStepCount: 1,
      auditStepCount: 0,
      evidence: [],
    })
    expect(toWorkflowFeatureSnapshot(features).changeMode).toBe('read_only')
  })
})

describe('redactRoutingAuditRecord', () => {
  it('redacts free-text audit fields', () => {
    const record = workflowRoutingAuditRecordSchema.parse({
      version: 1,
      at: new Date().toISOString(),
      taskRequirements: taskRoutingRequirementsSchema.parse({
        intent: [],
        expectedOutput: [],
        mayModifyCode: false,
        implementationAlreadyDecided: false,
        blockingUnknowns: ['sk-secret1234567890abcdef'],
      }),
      candidatePool: [],
      selectedWorkflow: 'default',
      confidence: 'low',
      decisionReason: 'sk-secret1234567890abcdef',
      comparedDifferences: [],
    })
    const redacted = redactRoutingAuditRecord(record)
    expect(redacted.taskRequirements.blockingUnknowns[0]).not.toContain('secret')
    expect(redacted.decisionReason).not.toContain('secret')
  })
})

describe('finalSelectionCandidateSummarySchema', () => {
  it('parses deterministic summary payload', () => {
    const parsed = finalSelectionCandidateSummarySchema.parse({
      workflowName: 'default',
      deterministicRank: 1,
      deterministicScore: 0.92,
      matchedFeatures: ['match:structure-fit'],
      routingGroups: ['general'],
      complexityBand: 'medium',
      safetyTier: 'safe',
      changeMode: 'mixed',
      primaryOutputs: ['code'],
      dominantModes: ['implement'],
      targetSurfaces: ['general'],
      canCompleteWithoutEditing: false,
      canCompleteBeforeFirstEdit: true,
      hasWriteTestsStep: true,
      hasReviewLoop: true,
      stepCount: 5,
      editStepCount: 2,
      shortReason: 'best deterministic rank',
    })
    expect(parsed.workflowName).toBe('default')
  })
})
