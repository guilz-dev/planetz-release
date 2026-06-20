import type {
  WorkflowAutoRoutePreviewResult,
  WorkflowGetPreviewInput,
  WorkflowPreviewAutoRouteInput,
  WorkflowPreviewResult,
  WorkflowRoutingCatalog,
  WorkflowSource,
} from '@planetz/shared'
import { parseWorkflowYaml } from '../../../shared/workflow-form/workflow-parse.js'
import { suggestLibraryAutoEnablement } from '../workflow-auto/library-auto-suggestion.js'
import type { WorkflowAutoRouteContext } from '../workflow-auto/router.js'
import { routeWorkflowAuto, routeWorkflowAutoDeterministic } from '../workflow-auto/router.js'
import { extractWorkflowStructureFeatures } from '../workflow-auto/workflow-feature-extractor.js'
import type { WorkflowYamlSource } from '../workflow-auto/workflow-yaml-resolver.js'
import type { WorkflowPreviewCache } from './workflow-preview-cache.js'
import { buildRoutingPromptHash } from './workflow-prompt-hash.js'
import {
  applyWorkflowRunOverride,
  workflowHasStrictSafetyTier,
} from './workflow-run-override-resolver.js'
import { workflowStepIsOverridable } from './workflow-step-override-policy.js'

export type WorkflowPreviewServiceDeps = {
  readWorkflowDocument: (
    name: string,
    source?: WorkflowGetPreviewInput['source'],
  ) => Promise<{ yaml: string; source: WorkflowSource }>
  loadWorkflowRoutingCatalog: () => Promise<WorkflowRoutingCatalog>
  listAvailableWorkflowNames: () => Promise<string[]>
  buildAutoRouteContext: (
    input: Pick<WorkflowPreviewAutoRouteInput, 'provider' | 'model'>,
  ) => Promise<WorkflowAutoRouteContext>
  previewCache: WorkflowPreviewCache
}

function mapWorkflowYamlSource(source: WorkflowSource): WorkflowYamlSource {
  if (source === 'builtin') return 'builtin'
  if (source === 'user') return 'imported'
  return 'project'
}

export async function getWorkflowPreview(
  deps: WorkflowPreviewServiceDeps,
  input: WorkflowGetPreviewInput,
  catalog: WorkflowRoutingCatalog,
): Promise<WorkflowPreviewResult> {
  const read = await deps.readWorkflowDocument(input.workflow, input.source)
  let yaml = read.yaml
  if (input.runOverride) {
    yaml = applyWorkflowRunOverride(yaml, input.runOverride)
  }
  const draft = parseWorkflowYaml(yaml)
  const features = await extractWorkflowStructureFeatures(input.workflow, async (name) => {
    if (name !== input.workflow) return null
    return { yaml, source: mapWorkflowYamlSource(read.source) }
  })
  if (!features) {
    throw new Error(`Failed to extract workflow features: ${input.workflow}`)
  }
  const catalogEntry = catalog.workflows.find((w) => w.name === input.workflow)
  const strictTier = workflowHasStrictSafetyTier(catalogEntry)
  return {
    name: input.workflow,
    source: features.source,
    description: draft.description,
    features,
    steps: draft.steps.map((step) => ({
      name: step.name,
      edit: step.edit,
      persona: step.persona,
      provider: step.provider,
      model: step.model,
      overridable: workflowStepIsOverridable(step.raw),
      policy: typeof step.raw.policy === 'string' ? step.raw.policy : undefined,
      knowledge: typeof step.raw.knowledge === 'string' ? step.raw.knowledge : undefined,
      instruction: step.instruction,
      permission: step.permission,
      rules: step.rules.map((rule) => ({
        condition:
          typeof rule.raw?.condition === 'string' ? rule.raw.condition : rule.text || undefined,
        next: rule.next || undefined,
        return: rule.return,
      })),
    })),
    initialStep: draft.initialStep,
    facets: {
      personas: draft.personas.map((s) => s.key),
      policies: draft.policies.map((s) => s.key),
      knowledge: draft.knowledge.map((s) => s.key),
      instructions: draft.instructions.map((s) => s.key),
      reportFormats: draft.reportFormats.map((s) => s.key),
    },
    strictTier,
    overridesAllowed: !strictTier,
  }
}

export async function previewWorkflowAutoRoute(
  deps: WorkflowPreviewServiceDeps,
  input: WorkflowPreviewAutoRouteInput,
): Promise<WorkflowAutoRoutePreviewResult> {
  const promptHash = buildRoutingPromptHash({ title: input.title, body: input.body })
  const prompt = [input.title, input.body]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .trim()

  const catalog = await deps.loadWorkflowRoutingCatalog()
  const availableWorkflowNames = await deps.listAvailableWorkflowNames()
  const ctx = await deps.buildAutoRouteContext(input)

  const routed =
    input.phase === 'full'
      ? await routeWorkflowAuto({ prompt, catalog, availableWorkflowNames }, ctx)
      : await routeWorkflowAutoDeterministic({ prompt, catalog, availableWorkflowNames }, ctx)

  const previewToken = deps.previewCache.put(promptHash, input.phase, routed.decision, routed.audit)

  let libraryAutoSuggestion: Awaited<ReturnType<typeof suggestLibraryAutoEnablement>>
  if (
    input.phase === 'deterministic' &&
    ctx.runtimeAutoFilter &&
    routed.audit &&
    prompt.length > 0
  ) {
    libraryAutoSuggestion = await suggestLibraryAutoEnablement({
      prompt,
      decision: routed.decision,
      audit: routed.audit,
      catalog,
      availableWorkflowNames,
      workflowsByName: ctx.runtimeAutoFilter.workflowsByName,
      uiPrefs: ctx.runtimeAutoFilter.uiPrefs,
      requirements: routed.audit.taskRequirements,
      ctx,
    })
  }

  return {
    previewToken,
    promptHash,
    phase: input.phase,
    decision: routed.decision,
    ...(routed.audit ? { audit: routed.audit } : {}),
    ...(libraryAutoSuggestion ? { libraryAutoSuggestion } : {}),
  }
}
