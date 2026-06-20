import {
  type AutoWorkflowDecision,
  applyKiroPhaseToRequirements,
  type EngineConfig,
  type FinalSelectionCandidateSummary,
  type KiroRoutingContext,
  ROUTING_REASON_CODES,
  resolveRoutingExecutionProfile,
  type TaskRoutingRequirements,
  WORKFLOW_AUTO_FINAL_CANDIDATES,
  WORKFLOW_AUTO_FINAL_SHORT_CIRCUIT_SCORE_GAP,
  type WorkflowRoutingAuditRecord,
  type WorkflowRoutingCatalog,
} from '@planetz/shared'
import {
  inferTaskRoutingRequirementsFromPrompt,
  normalizePromptForRouting,
} from '../workflow-auto-classifier.js'
import {
  buildScoredRoutingCandidates,
  type StructureRoutingCandidate,
} from './candidate-builder.js'
import { validateWorkflowFinalSelection } from './decision-validator.js'
import {
  listEnabledAutoWorkflowNames,
  type RuntimeAutoWorkflowFilter,
} from './enabled-workflows.js'
import { selectWorkflowFinal } from './final-selector.js'
import { routingLlmFailureCodeFromError } from './llm-client.js'
import { pickPreferredFallbackCandidate } from './pick-preferred-fallback-candidate.js'
import { buildRoutingAuditRecord } from './routing-audit-builder.js'
import {
  finalizeRoutingFallback,
  routingFallbackReasonCode,
  traceWorkflowAutoFallback,
} from './routing-fallback.js'
import type { WorkflowRoutingFeatureCache } from './routing-feature-cache.js'
import type { TaskRequirementsExtractResult } from './task-requirements.js'
import { extractTaskRoutingRequirements } from './task-requirements.js'
import { buildWorkflowFeatureIndex, type WorkflowFeatureIndex } from './workflow-feature-index.js'
import type { WorkflowYamlResolver } from './workflow-yaml-resolver.js'

export interface WorkflowAutoRouteContext {
  cwd: string
  engineConfig: EngineConfig
  provider?: string
  model?: string
  resolveWorkflowYaml: WorkflowYamlResolver
  featureCache?: WorkflowRoutingFeatureCache
  runtimeAutoFilter?: RuntimeAutoWorkflowFilter
  resolveKiroRoutingContext?: () => Promise<KiroRoutingContext | null>
}

export interface WorkflowAutoRouteInput {
  prompt: string
  catalog: WorkflowRoutingCatalog
  availableWorkflowNames: string[]
}

export type WorkflowAutoRouteResult = {
  decision: AutoWorkflowDecision
  audit: WorkflowRoutingAuditRecord
}

function decisionFromSingleCandidate(candidate: StructureRoutingCandidate): AutoWorkflowDecision {
  return {
    selectedWorkflow: candidate.workflowName,
    group: candidate.group,
    confidence: 'high',
    score: Math.max(candidate.score, 0.9),
    fallbackApplied: false,
    alternatives: [],
    reasonCodes: [...candidate.matchedFeatures, ROUTING_REASON_CODES.routing.singleCandidate],
  }
}

function decisionFromTopCandidateShortCircuit(
  requirementsReasonCodes: string[],
  top: StructureRoutingCandidate,
  alternatives: StructureRoutingCandidate[],
): AutoWorkflowDecision {
  return {
    selectedWorkflow: top.workflowName,
    group: top.group,
    confidence: 'high',
    score: top.score,
    fallbackApplied: false,
    alternatives: alternatives.slice(0, 3).map((candidate) => ({
      name: candidate.workflowName,
      group: candidate.group,
      score: candidate.score,
    })),
    reasonCodes: [
      ...requirementsReasonCodes,
      ...top.matchedFeatures,
      ROUTING_REASON_CODES.routing.deterministicShortCircuit,
    ],
  }
}

function buildCandidateShortReason(candidate: StructureRoutingCandidate): string {
  if (candidate.matchedFeatures.length > 0) {
    return `deterministic signals: ${candidate.matchedFeatures.slice(0, 2).join(', ')}`
  }
  if (candidate.features.canCompleteWithoutEditing) {
    return 'supports report-only completion without forced edits'
  }
  if (candidate.features.hasWriteTestsStep) {
    return 'includes explicit test-writing path'
  }
  return 'best deterministic rank with least structural conflict'
}

function buildFinalSelectionCandidateSummaries(
  candidates: StructureRoutingCandidate[],
): FinalSelectionCandidateSummary[] {
  return candidates.map((candidate, index) => ({
    workflowName: candidate.workflowName,
    deterministicRank: index + 1,
    deterministicScore: candidate.score,
    matchedFeatures: [...candidate.matchedFeatures],
    routingGroups: [...candidate.routingGroups],
    ...(candidate.complexityBand ? { complexityBand: candidate.complexityBand } : {}),
    ...(candidate.safetyTier ? { safetyTier: candidate.safetyTier } : {}),
    changeMode: candidate.features.changeMode,
    primaryOutputs: [...candidate.features.primaryOutputs],
    dominantModes: [...candidate.features.dominantModes],
    targetSurfaces: [...candidate.features.targetSurfaces],
    canCompleteWithoutEditing: candidate.features.canCompleteWithoutEditing,
    canCompleteBeforeFirstEdit: candidate.features.canCompleteBeforeFirstEdit,
    hasWriteTestsStep: candidate.features.hasWriteTestsStep,
    hasReviewLoop: candidate.features.hasReviewLoop,
    stepCount: candidate.features.stepCount,
    editStepCount: candidate.features.editStepCount,
    shortReason: buildCandidateShortReason(candidate),
  }))
}

function shouldShortCircuitFinalSelection(
  requirements: TaskRoutingRequirements,
  topCandidates: StructureRoutingCandidate[],
): boolean {
  const top1 = topCandidates[0]
  const top2 = topCandidates[1]
  if (!top1 || !top2) return false
  if (top1.safetyTier === 'strict') return false
  if (requirements.ambiguity === 'high') return false
  return top1.score - top2.score >= WORKFLOW_AUTO_FINAL_SHORT_CIRCUIT_SCORE_GAP
}

function rejectedWorkflowNames(candidates: StructureRoutingCandidate[]): Set<string> {
  return new Set(candidates.filter((c) => c.rejected).map((c) => c.workflowName))
}

async function resolveFeatureIndex(
  ctx: WorkflowAutoRouteContext,
  workflowNames: string[],
): Promise<WorkflowFeatureIndex> {
  if (ctx.featureCache) {
    return ctx.featureCache.resolveMissing(workflowNames, ctx.resolveWorkflowYaml)
  }
  return buildWorkflowFeatureIndex(workflowNames, ctx.resolveWorkflowYaml)
}

async function applyKiroRoutingOverlay(
  requirementsResult: TaskRequirementsExtractResult,
  ctx: WorkflowAutoRouteContext,
): Promise<TaskRequirementsExtractResult> {
  if (!ctx.resolveKiroRoutingContext) return requirementsResult
  const kiroCtx = await ctx.resolveKiroRoutingContext()
  if (!kiroCtx || kiroCtx.kiroPhase === 'none' || kiroCtx.kiroPhase === 'complete') {
    return requirementsResult
  }
  return {
    ...requirementsResult,
    requirements: applyKiroPhaseToRequirements(requirementsResult.requirements, kiroCtx),
    reasonCodes: [
      ...requirementsResult.reasonCodes,
      ROUTING_REASON_CODES.requirements.kiroPhaseGate,
    ],
  }
}

/** Deterministic routing only (no final LLM compare); used for composer preview. */
export async function routeWorkflowAutoDeterministic(
  input: WorkflowAutoRouteInput,
  ctx: WorkflowAutoRouteContext,
): Promise<WorkflowAutoRouteResult> {
  const normalizedPrompt = normalizePromptForRouting(input.prompt)
  if (normalizedPrompt.length === 0) {
    traceWorkflowAutoFallback('empty-prompt')
    const decision = finalizeRoutingFallback(input.catalog, input.availableWorkflowNames, [
      ROUTING_REASON_CODES.fallback.emptyPrompt,
    ])
    const audit = buildRoutingAuditRecord({
      requirementsResult: {
        requirements: inferTaskRoutingRequirementsFromPrompt(''),
        reasonCodes: [ROUTING_REASON_CODES.fallback.emptyPrompt],
      },
      pool: [],
      decision,
    })
    return { decision, audit }
  }

  const requirementsResult = await applyKiroRoutingOverlay(
    await extractTaskRoutingRequirements({
      prompt: input.prompt,
      provider: undefined,
      model: undefined,
      cwd: ctx.cwd,
      engineConfig: ctx.engineConfig,
    }),
    ctx,
  )

  const enabledNames = listEnabledAutoWorkflowNames(
    input.catalog,
    input.availableWorkflowNames,
    ctx.runtimeAutoFilter,
  )
  const featureIndex = await resolveFeatureIndex(ctx, enabledNames)
  const pool = buildScoredRoutingCandidates({
    catalog: input.catalog,
    featuresByName: featureIndex,
    requirements: requirementsResult.requirements,
    availableWorkflowNames: input.availableWorkflowNames,
    runtimeAutoFilter: ctx.runtimeAutoFilter,
  })

  const auditFor = (decision: AutoWorkflowDecision): WorkflowRoutingAuditRecord =>
    buildRoutingAuditRecord({
      requirementsResult,
      pool,
      decision,
    })

  const viable = pool.filter((c) => !c.rejected)
  const excludedFallback = rejectedWorkflowNames(pool)
  const preferredFallback =
    viable.length > 0
      ? (pickPreferredFallbackCandidate(requirementsResult.requirements, viable) ??
        viable[0]?.workflowName)
      : undefined

  if (viable.length === 0) {
    traceWorkflowAutoFallback('all-rejected')
    const decision = finalizeRoutingFallback(
      input.catalog,
      input.availableWorkflowNames,
      [ROUTING_REASON_CODES.fallback.allRejected],
      undefined,
      undefined,
      excludedFallback,
    )
    return { decision, audit: auditFor(decision) }
  }

  if (viable.length === 1 && viable[0]?.safetyTier !== 'strict') {
    const decision = decisionFromSingleCandidate(viable[0]!)
    return { decision, audit: auditFor(decision) }
  }

  const top = viable[0]
  if (!top) {
    const decision = finalizeRoutingFallback(
      input.catalog,
      input.availableWorkflowNames,
      [ROUTING_REASON_CODES.fallback.default],
      preferredFallback,
      undefined,
      excludedFallback,
    )
    return { decision, audit: auditFor(decision) }
  }

  const decision: AutoWorkflowDecision = {
    selectedWorkflow: preferredFallback ?? top.workflowName,
    group: top.group,
    confidence: 'medium',
    score: top.score,
    fallbackApplied: false,
    alternatives: viable.slice(1, 4).map((c) => ({
      name: c.workflowName,
      group: c.group,
      score: c.score,
    })),
    reasonCodes: [...requirementsResult.reasonCodes, ROUTING_REASON_CODES.routing.singleCandidate],
  }
  return { decision, audit: auditFor(decision) }
}

export async function routeWorkflowAuto(
  input: WorkflowAutoRouteInput,
  ctx: WorkflowAutoRouteContext,
): Promise<WorkflowAutoRouteResult> {
  const normalizedPrompt = normalizePromptForRouting(input.prompt)
  const profile = resolveRoutingExecutionProfile(ctx.engineConfig, {
    provider: ctx.provider,
    model: ctx.model,
  })
  const provider = profile.provider?.trim()

  if (normalizedPrompt.length === 0) {
    traceWorkflowAutoFallback('empty-prompt')
    const decision = finalizeRoutingFallback(input.catalog, input.availableWorkflowNames, [
      ROUTING_REASON_CODES.fallback.emptyPrompt,
    ])
    const audit = buildRoutingAuditRecord({
      requirementsResult: {
        requirements: inferTaskRoutingRequirementsFromPrompt(''),
        reasonCodes: [ROUTING_REASON_CODES.fallback.emptyPrompt],
      },
      pool: [],
      decision,
    })
    return { decision, audit }
  }

  const requirementsResult = await applyKiroRoutingOverlay(
    await extractTaskRoutingRequirements({
      prompt: input.prompt,
      provider,
      model: profile.model,
      cwd: ctx.cwd,
      engineConfig: ctx.engineConfig,
    }),
    ctx,
  )

  const enabledNames = listEnabledAutoWorkflowNames(
    input.catalog,
    input.availableWorkflowNames,
    ctx.runtimeAutoFilter,
  )
  const featureIndex = await resolveFeatureIndex(ctx, enabledNames)
  const pool = buildScoredRoutingCandidates({
    catalog: input.catalog,
    featuresByName: featureIndex,
    requirements: requirementsResult.requirements,
    availableWorkflowNames: input.availableWorkflowNames,
    runtimeAutoFilter: ctx.runtimeAutoFilter,
  })

  const auditFor = (
    decision: AutoWorkflowDecision,
    extra?: {
      decisionReason?: string
      comparedDifferences?: string[]
      llm?: WorkflowRoutingAuditRecord['llm']
    },
  ): WorkflowRoutingAuditRecord =>
    buildRoutingAuditRecord({
      requirementsResult,
      pool,
      decision,
      ...extra,
    })

  const viable = pool.filter((c) => !c.rejected)
  const excludedFallback = rejectedWorkflowNames(pool)
  const preferredFallback =
    viable.length > 0
      ? (pickPreferredFallbackCandidate(requirementsResult.requirements, viable) ??
        viable[0]?.workflowName)
      : undefined

  if (viable.length === 0) {
    traceWorkflowAutoFallback('all-rejected')
    const decision = finalizeRoutingFallback(
      input.catalog,
      input.availableWorkflowNames,
      [ROUTING_REASON_CODES.fallback.allRejected],
      undefined,
      undefined,
      excludedFallback,
    )
    return { decision, audit: auditFor(decision) }
  }

  if (viable.length === 1 && viable[0]?.safetyTier !== 'strict') {
    const decision = decisionFromSingleCandidate(viable[0]!)
    return { decision, audit: auditFor(decision) }
  }

  if (!provider) {
    traceWorkflowAutoFallback('no-provider')
    const decision = finalizeRoutingFallback(
      input.catalog,
      input.availableWorkflowNames,
      [ROUTING_REASON_CODES.fallback.noProvider],
      preferredFallback,
      undefined,
      excludedFallback,
    )
    return { decision, audit: auditFor(decision) }
  }

  const topCandidates = viable.slice(0, WORKFLOW_AUTO_FINAL_CANDIDATES)
  if (shouldShortCircuitFinalSelection(requirementsResult.requirements, topCandidates)) {
    const top = topCandidates[0]!
    const decision = decisionFromTopCandidateShortCircuit(
      requirementsResult.reasonCodes,
      top,
      topCandidates.slice(1),
    )
    return { decision, audit: auditFor(decision) }
  }
  const finalStartedAt = Date.now()

  try {
    const selection = await selectWorkflowFinal({
      prompt: input.prompt,
      requirements: requirementsResult.requirements,
      candidates: buildFinalSelectionCandidateSummaries(topCandidates),
      provider,
      model: profile.model,
      cwd: ctx.cwd,
      engineConfig: ctx.engineConfig,
    })

    const validated = validateWorkflowFinalSelection({
      output: selection,
      candidates: topCandidates,
    })

    const finalMeta = {
      provider,
      model: profile.model,
      latencyMs: Date.now() - finalStartedAt,
    }

    if (!validated.ok) {
      traceWorkflowAutoFallback('validation-failed', { failureCode: validated.failureCode })
      const decision = finalizeRoutingFallback(
        input.catalog,
        input.availableWorkflowNames,
        [validated.fallbackReasonCode, ...requirementsResult.reasonCodes],
        preferredFallback,
        finalMeta,
        excludedFallback,
      )
      return {
        decision,
        audit: auditFor(decision, {
          decisionReason: selection.decisionReason,
          comparedDifferences: selection.comparedDifferences,
          llm: { final: { ...finalMeta, failureCode: validated.failureCode } },
        }),
      }
    }

    const decision: AutoWorkflowDecision = {
      ...validated.decision,
      fallbackApplied: false,
      reasonCodes: [...requirementsResult.reasonCodes, ...validated.decision.reasonCodes],
      llm: finalMeta,
    }
    return {
      decision,
      audit: auditFor(decision, {
        decisionReason: selection.decisionReason,
        comparedDifferences: selection.comparedDifferences,
        llm: { final: finalMeta },
      }),
    }
  } catch (error: unknown) {
    const failureCode = routingLlmFailureCodeFromError(error)
    traceWorkflowAutoFallback('llm-error', { failureCode })
    const finalMeta = {
      provider,
      model: profile.model,
      latencyMs: Date.now() - finalStartedAt,
      failureCode,
    }
    const decision = finalizeRoutingFallback(
      input.catalog,
      input.availableWorkflowNames,
      [routingFallbackReasonCode(failureCode), ...requirementsResult.reasonCodes],
      preferredFallback,
      finalMeta,
      excludedFallback,
    )
    return {
      decision,
      audit: auditFor(decision, { llm: { final: finalMeta } }),
    }
  }
}
