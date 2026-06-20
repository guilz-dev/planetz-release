import {
  matchRoutingTargetSurfacesFromText,
  WORKFLOW_COMPLETION_PATH_MAX_DEPTH,
  WORKFLOW_FEATURE_EDIT_HEAVY_RATIO,
  WORKFLOW_FEATURE_MAX_CALL_DEPTH,
  type WorkflowDominantMode,
  type WorkflowFeatureEvidence,
  type WorkflowFeatureSource,
  type WorkflowPrimaryOutput,
  type WorkflowStructureFeatures,
} from '@planetz/shared'
import type {
  StepDraft,
  WorkflowDraft,
} from '../../../shared/workflow-form/workflow-draft-types.js'
import { stepHasReportOutputContracts } from '../../../shared/workflow-form/workflow-output-contracts.js'
import { parseWorkflowYaml } from '../../../shared/workflow-form/workflow-parse.js'
import { RESERVED_STEP_NAMES } from '../../../shared/workflow-form/workflow-shared-constants.js'
import type { WorkflowYamlResolver } from './workflow-yaml-resolver.js'

const INVESTIGATE_TOKENS = [
  'research',
  'investigate',
  'dig',
  'analysis',
  'planner',
  'plan',
  'spike',
]
const REVIEW_TOKENS = ['review', 'peer-review', 'audit']
const IMPLEMENT_TOKENS = ['implement', 'coder', 'draft', 'write_tests', 'write-tests']
const AUDIT_TOKENS = ['audit']
const REFACTOR_TOKENS = ['refactor']

type PathFlags = {
  canCompleteWithoutEditing: boolean
  canCompleteBeforeFirstEdit: boolean
  forcesImplementationOnAllPaths: boolean
  hasImplementationPath: boolean
}

function tokenize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
}

function collectTokens(draft: WorkflowDraft, step: StepDraft): string[] {
  const parts: string[] = [step.name, step.persona ?? '', step.instruction ?? '']
  for (const section of [
    draft.personas,
    draft.policies,
    draft.knowledge,
    draft.instructions,
    draft.reportFormats,
  ]) {
    if (!Array.isArray(section)) continue
    for (const entry of section) {
      parts.push(entry.key)
    }
  }
  if (Array.isArray(step.raw.policy)) {
    for (const p of step.raw.policy) {
      if (typeof p === 'string') parts.push(p)
    }
  }
  if (Array.isArray(step.raw.knowledge)) {
    for (const k of step.raw.knowledge) {
      if (typeof k === 'string') parts.push(k)
    }
  }
  return parts.flatMap((p) => tokenize(p).split(/\s+/).filter(Boolean))
}

function matchDominantModes(tokens: string[]): WorkflowDominantMode[] {
  const modes = new Set<WorkflowDominantMode>()
  const joined = tokens.join(' ')
  if (INVESTIGATE_TOKENS.some((t) => joined.includes(t))) modes.add('investigate')
  if (IMPLEMENT_TOKENS.some((t) => joined.includes(t))) modes.add('implement')
  if (REVIEW_TOKENS.some((t) => joined.includes(t))) modes.add('review')
  if (AUDIT_TOKENS.some((t) => joined.includes(t))) modes.add('audit')
  if (REFACTOR_TOKENS.some((t) => joined.includes(t))) modes.add('refactor')
  return [...modes]
}

function matchSurfaces(tokens: string[]) {
  return matchRoutingTargetSurfacesFromText(tokens.join(' '))
}

function workflowCallTarget(step: StepDraft): string | null {
  if (step.special !== 'workflow_call') return null
  const call = step.raw.call
  if (typeof call === 'string' && call.trim()) return call.trim()
  const wfCall = step.raw.workflow_call
  if (typeof wfCall === 'string' && wfCall.trim()) return wfCall.trim()
  return null
}

function stepHasEdit(step: StepDraft): boolean {
  return step.edit === true
}

function stepHasReportOutput(step: StepDraft): boolean {
  return stepHasReportOutputContracts(step.raw as Record<string, unknown>)
}

function analyzeCompletionPaths(draft: WorkflowDraft): PathFlags {
  const stepByName = new Map(draft.steps.map((s) => [s.name, s]))
  const initial = draft.initialStep ?? draft.steps[0]?.name
  if (!initial || !stepByName.has(initial)) {
    return {
      canCompleteWithoutEditing: false,
      canCompleteBeforeFirstEdit: false,
      forcesImplementationOnAllPaths: false,
      hasImplementationPath: false,
    }
  }

  const completePaths: Array<{ hadEdit: boolean }> = []

  function walk(stepName: string, hadEdit: boolean, visited: Set<string>, depth: number): void {
    if (depth > WORKFLOW_COMPLETION_PATH_MAX_DEPTH) return
    if (RESERVED_STEP_NAMES.has(stepName)) {
      if (stepName === 'COMPLETE') completePaths.push({ hadEdit })
      return
    }
    const step = stepByName.get(stepName)
    if (!step) return
    const visitKey = `${stepName}:${hadEdit}`
    if (visited.has(visitKey)) return
    visited.add(visitKey)

    const nextHadEdit = hadEdit || stepHasEdit(step)
    if (step.special === 'workflow_call') {
      // Treat workflow_call as requiring downstream implementation when parent continues after call.
      if (step.rules.length === 0) {
        walk('COMPLETE', nextHadEdit, new Set(visited), depth + 1)
        return
      }
    }

    if (step.rules.length === 0) {
      walk('COMPLETE', nextHadEdit, new Set(visited), depth + 1)
      return
    }

    for (const rule of step.rules) {
      const target = rule.next?.trim() || rule.return?.trim()
      if (!target) continue
      walk(target, nextHadEdit, new Set(visited), depth + 1)
    }
  }

  walk(initial, false, new Set(), 0)

  if (completePaths.length === 0) {
    const anyEdit = draft.steps.some(stepHasEdit)
    return {
      canCompleteWithoutEditing: !anyEdit,
      canCompleteBeforeFirstEdit: !anyEdit,
      forcesImplementationOnAllPaths: anyEdit,
      hasImplementationPath: anyEdit,
    }
  }

  const canCompleteBeforeFirstEdit = completePaths.some((p) => !p.hadEdit)
  const canCompleteWithoutEditing = completePaths.every((p) => !p.hadEdit)
  const forcesImplementationOnAllPaths = completePaths.every((p) => p.hadEdit)
  const hasImplementationPath =
    draft.steps.some(stepHasEdit) || draft.steps.some((s) => s.special === 'workflow_call')

  return {
    canCompleteWithoutEditing,
    canCompleteBeforeFirstEdit,
    forcesImplementationOnAllPaths,
    hasImplementationPath,
  }
}

function mergePathFlags(base: PathFlags, extra: PathFlags): PathFlags {
  return {
    canCompleteWithoutEditing: base.canCompleteWithoutEditing && extra.canCompleteWithoutEditing,
    canCompleteBeforeFirstEdit: base.canCompleteBeforeFirstEdit || extra.canCompleteBeforeFirstEdit,
    forcesImplementationOnAllPaths:
      base.forcesImplementationOnAllPaths && extra.forcesImplementationOnAllPaths,
    hasImplementationPath: base.hasImplementationPath || extra.hasImplementationPath,
  }
}

function countStepsByKind(
  steps: StepDraft[],
  tokens: string[],
): { review: number; investigate: number; audit: number } {
  let review = 0
  let investigate = 0
  let audit = 0
  const joined = tokens.join(' ')
  for (const step of steps) {
    const t = [step.name, step.persona ?? '', step.instruction ?? ''].join(' ').toLowerCase()
    if (REVIEW_TOKENS.some((k) => t.includes(k) || step.name.includes(k))) review += 1
    if (INVESTIGATE_TOKENS.some((k) => t.includes(k) || step.name.includes(k))) investigate += 1
    if (AUDIT_TOKENS.some((k) => t.includes(k) || step.name.includes(k))) audit += 1
  }
  if (REVIEW_TOKENS.some((k) => joined.includes(k))) review += 1
  return { review, investigate, audit }
}

async function extractFromDraft(
  draft: WorkflowDraft,
  workflowName: string,
  source: WorkflowFeatureSource,
  resolver: WorkflowYamlResolver,
  visited: Set<string>,
  depth: number,
  evidence: WorkflowFeatureEvidence[],
): Promise<WorkflowStructureFeatures> {
  const allSteps: StepDraft[] = [...draft.steps]
  let hasWorkflowCall = false
  let subPathFlags: PathFlags | null = null

  if (depth < WORKFLOW_FEATURE_MAX_CALL_DEPTH) {
    for (const step of draft.steps) {
      const target = workflowCallTarget(step)
      if (!target) continue
      hasWorkflowCall = true
      if (visited.has(target)) {
        evidence.push({
          feature: 'workflow_call',
          reason: 'cycle detected',
          path: `step:${step.name}`,
        })
        continue
      }
      const resolved = await resolver(target)
      if (!resolved) {
        evidence.push({
          feature: 'workflow_call',
          reason: 'missing callee',
          path: `step:${step.name}->${target}`,
        })
        continue
      }
      const subDraft = parseWorkflowYaml(resolved.yaml)
      const subVisited = new Set(visited)
      subVisited.add(target)
      const subFeatures = await extractFromDraft(
        subDraft,
        target,
        resolved.source,
        resolver,
        subVisited,
        depth + 1,
        evidence,
      )
      const subFlags = {
        canCompleteWithoutEditing: subFeatures.canCompleteWithoutEditing,
        canCompleteBeforeFirstEdit: subFeatures.canCompleteBeforeFirstEdit,
        forcesImplementationOnAllPaths: subFeatures.forcesImplementationOnAllPaths,
        hasImplementationPath: subFeatures.hasImplementationPath,
      }
      subPathFlags = subPathFlags ? mergePathFlags(subPathFlags, subFlags) : subFlags
      if (subFeatures.hasImplementationPath) {
        evidence.push({
          feature: 'hasImplementationPath',
          reason: 'subworkflow',
          path: `workflow_call:${target}`,
        })
      }
      for (const subStep of subDraft.steps) {
        if (!allSteps.some((s) => s.name === subStep.name)) allSteps.push(subStep)
      }
    }
  }

  const tokens = allSteps.flatMap((step) => collectTokens(draft, step))
  const editStepCount = allSteps.filter(stepHasEdit).length
  const stepCount = allSteps.length
  const editRatio = stepCount > 0 ? editStepCount / stepCount : 0
  let changeMode: WorkflowStructureFeatures['changeMode'] = 'mixed'
  if (editStepCount === 0) changeMode = 'read_only'
  else if (editRatio >= WORKFLOW_FEATURE_EDIT_HEAVY_RATIO) changeMode = 'edit_heavy'

  const hasWriteTestsStep = allSteps.some((s) => {
    const name = tokenize(s.name)
    return (
      (name.includes('write') && name.includes('test')) ||
      tokenize(s.instruction ?? '').includes('write-test')
    )
  })

  const primaryOutputs = new Set<WorkflowPrimaryOutput>()
  if (allSteps.some(stepHasReportOutput)) primaryOutputs.add('report')
  if (editStepCount > 0) primaryOutputs.add('code')
  if (hasWriteTestsStep) primaryOutputs.add('tests')
  if (allSteps.some((s) => REVIEW_TOKENS.some((t) => s.name.includes(t)))) {
    primaryOutputs.add('review-findings')
  }

  const localPaths = analyzeCompletionPaths(draft)
  const paths =
    hasWorkflowCall && subPathFlags ? mergePathFlags(localPaths, subPathFlags) : localPaths

  const counts = countStepsByKind(allSteps, tokens)
  const loopMonitors = draft.loopMonitors
  const hasLoopMonitor = loopMonitors !== undefined && loopMonitors !== null
  const hasFixLoop =
    hasLoopMonitor ||
    JSON.stringify(loopMonitors ?? '').includes('fix') ||
    draft.steps.some((s) => s.name.includes('fix'))

  const dominantModes = matchDominantModes(tokens)
  const targetSurfaces = matchSurfaces(tokens)

  if (paths.forcesImplementationOnAllPaths) {
    evidence.push({
      feature: 'forcesImplementationOnAllPaths',
      reason: 'all completion paths require edit',
      path: workflowName,
    })
  }
  if (paths.canCompleteBeforeFirstEdit) {
    evidence.push({
      feature: 'canCompleteBeforeFirstEdit',
      reason: 'read-only completion path',
      path: workflowName,
    })
  }
  if (paths.canCompleteWithoutEditing) {
    evidence.push({
      feature: 'canCompleteWithoutEditing',
      reason: 'all completion paths avoid edit',
      path: workflowName,
    })
  }

  return {
    workflowName,
    source,
    canCompleteWithoutEditing: paths.canCompleteWithoutEditing,
    canCompleteBeforeFirstEdit: paths.canCompleteBeforeFirstEdit,
    forcesImplementationOnAllPaths: paths.forcesImplementationOnAllPaths,
    hasImplementationPath: paths.hasImplementationPath,
    forcesTestWriting: hasWriteTestsStep,
    requiresClearSpec: draft.steps.some((s) => s.name === 'plan'),
    changeMode,
    primaryOutputs: [...primaryOutputs],
    dominantModes: dominantModes.length > 0 ? dominantModes : ['implement'],
    targetSurfaces,
    hasWriteTestsStep,
    hasReviewLoop: counts.review > 1 || allSteps.some((s) => s.name.includes('review')),
    hasFixLoop,
    hasParallelReview: counts.review > 1,
    hasWorkflowCall,
    hasLoopMonitor,
    personaKeys: draft.personas.map((p) => p.key),
    policyKeys: draft.policies.map((p) => p.key),
    knowledgeKeys: draft.knowledge.map((p) => p.key),
    instructionKeys: draft.instructions.map((p) => p.key),
    reportFormatKeys: draft.reportFormats.map((p) => p.key),
    stepCount,
    editStepCount,
    reviewStepCount: counts.review,
    investigateStepCount: counts.investigate,
    auditStepCount: counts.audit,
    evidence,
  }
}

export async function extractWorkflowStructureFeatures(
  workflowName: string,
  resolver: WorkflowYamlResolver,
): Promise<WorkflowStructureFeatures | null> {
  const resolved = await resolver(workflowName)
  if (!resolved) return null
  const draft = parseWorkflowYaml(resolved.yaml)
  if (draft.parseError || draft.steps.length === 0) return null
  const evidence: WorkflowFeatureEvidence[] = []
  return extractFromDraft(
    draft,
    workflowName,
    resolved.source,
    resolver,
    new Set([workflowName]),
    0,
    evidence,
  )
}
