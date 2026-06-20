import { z } from 'zod'
import { libraryAutoSuggestionSchema } from './library-auto-suggestion.js'
import { autoWorkflowDecisionSchema } from './workflow-auto-routing-schema.js'
import {
  workflowFeatureSourceSchema,
  workflowRoutingAuditRecordSchema,
  workflowStructureFeaturesSchema,
} from './workflow-structure-routing-schema.js'

/** How the workflow was chosen for display on queue cards (⚡ / ◈ / manual). */
export const workflowSelectionKindSchema = z.enum(['auto', 'modified', 'manual'])

export type WorkflowSelectionKind = z.infer<typeof workflowSelectionKindSchema>

export const workflowStepOverrideSchema = z
  .object({
    stepName: z.string().trim().min(1),
    provider: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.provider && !value.model) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'step override must set provider or model',
        path: ['provider'],
      })
    }
    if (value.model && !value.provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'model override requires provider',
        path: ['provider'],
      })
    }
  })

export type WorkflowStepOverride = z.infer<typeof workflowStepOverrideSchema>

/** Ephemeral per-run workflow adjustments; canonical workflow YAML is not mutated. */
export const workflowRunOverrideSchema = z.object({
  baseWorkflow: z.string().trim().min(1),
  stepOverrides: z.array(workflowStepOverrideSchema).default([]),
})

export type WorkflowRunOverride = z.infer<typeof workflowRunOverrideSchema>

export const taskWorkflowSelectionMetaSchema = z.object({
  kind: workflowSelectionKindSchema,
  baseWorkflow: z.string().trim().min(1),
  /** Resolved workflow name passed to takt (may differ when modified). */
  resolvedWorkflow: z.string().trim().min(1).optional(),
  runOverride: workflowRunOverrideSchema.optional(),
  /** Serialized override snapshot for audit / replay. */
  runOverrideJson: z.string().optional(),
})

export type TaskWorkflowSelectionMeta = z.infer<typeof taskWorkflowSelectionMetaSchema>

/** Outgoing edge of a step for the picker step graph (`rules[].next` / `return`). */
export const workflowPreviewStepRuleSchema = z.object({
  condition: z.string().optional(),
  next: z.string().optional(),
  return: z.string().optional(),
})

export type WorkflowPreviewStepRule = z.infer<typeof workflowPreviewStepRuleSchema>

export const workflowPreviewStepSchema = z.object({
  name: z.string(),
  edit: z.boolean().optional(),
  persona: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  overridable: z.boolean().optional(),
  /** Facet refs and inline instruction for the picker's step detail pane. */
  policy: z.string().optional(),
  knowledge: z.string().optional(),
  instruction: z.string().optional(),
  permission: z.enum(['readonly', 'edit', 'full']).optional(),
  rules: z.array(workflowPreviewStepRuleSchema).optional(),
})

export type WorkflowPreviewStep = z.infer<typeof workflowPreviewStepSchema>

/** Workflow-level facet section keys (personas / policies / knowledge / ...). */
export const workflowPreviewFacetsSchema = z.object({
  personas: z.array(z.string()),
  policies: z.array(z.string()),
  knowledge: z.array(z.string()),
  instructions: z.array(z.string()),
  reportFormats: z.array(z.string()),
})

export type WorkflowPreviewFacets = z.infer<typeof workflowPreviewFacetsSchema>

export const workflowPreviewResultSchema = z.object({
  name: z.string(),
  source: workflowFeatureSourceSchema,
  description: z.string().optional(),
  features: workflowStructureFeaturesSchema,
  steps: z.array(workflowPreviewStepSchema),
  initialStep: z.string().optional(),
  facets: workflowPreviewFacetsSchema.optional(),
  strictTier: z.boolean(),
  overridesAllowed: z.boolean(),
})

export type WorkflowPreviewResult = z.infer<typeof workflowPreviewResultSchema>

export const workflowGetPreviewInputSchema = z.object({
  workflow: z.string().trim().min(1),
  source: z.enum(['builtin', 'project', 'user', 'imported']).optional(),
  runOverride: workflowRunOverrideSchema.optional(),
})

export type WorkflowGetPreviewInput = z.infer<typeof workflowGetPreviewInputSchema>

export const workflowPreviewAutoRoutePhaseSchema = z.enum(['deterministic', 'full'])

export const workflowPreviewAutoRouteInputSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  phase: workflowPreviewAutoRoutePhaseSchema.default('deterministic'),
  provider: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
})

export type WorkflowPreviewAutoRouteInput = z.infer<typeof workflowPreviewAutoRouteInputSchema>

export const workflowAutoRoutePreviewResultSchema = z.object({
  previewToken: z.string().min(1),
  promptHash: z.string().min(1),
  phase: workflowPreviewAutoRoutePhaseSchema,
  decision: autoWorkflowDecisionSchema,
  audit: workflowRoutingAuditRecordSchema.optional(),
  libraryAutoSuggestion: libraryAutoSuggestionSchema.optional(),
})

export type WorkflowAutoRoutePreviewResult = z.infer<typeof workflowAutoRoutePreviewResultSchema>

export const taskSwapWorkflowInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1),
  workflow: z.string().trim().min(1),
  workflowMode: z.enum(['manual', 'auto']).optional(),
  runOverride: workflowRunOverrideSchema.optional(),
  selectionKind: workflowSelectionKindSchema.optional(),
})

export type TaskSwapWorkflowInput = z.infer<typeof taskSwapWorkflowInputSchema>

export const taskSwapWorkflowResultSchema = z.object({
  taskId: z.string(),
  workflow: z.string(),
})

export type TaskSwapWorkflowResult = z.infer<typeof taskSwapWorkflowResultSchema>
