import { z } from 'zod'

export const ROUTING_GROUPS = [
  'bugfix',
  'feature',
  'refactor',
  'docs',
  'ops',
  'research',
  'review',
  'general',
] as const

export type RoutingGroup = (typeof ROUTING_GROUPS)[number]

export const routingGroupSchema = z.enum(ROUTING_GROUPS)

export const workflowRoutingKeywordsSchema = z.object({
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
})

export const workflowRoutingEntrySchema = z.object({
  name: z.string().trim().min(1),
  enabledForAuto: z.boolean().default(true),
  routingGroups: z.array(routingGroupSchema).min(1),
  keywords: workflowRoutingKeywordsSchema.optional(),
  complexityBand: z.enum(['low', 'medium', 'high']).optional(),
  safetyTier: z.enum(['safe', 'strict']).optional(),
})

export const workflowRoutingCatalogSchema = z.object({
  version: z.number().int().positive().default(1),
  groups: z.array(routingGroupSchema).default([...ROUTING_GROUPS]),
  workflows: z.array(workflowRoutingEntrySchema),
})

export type WorkflowRoutingEntry = z.infer<typeof workflowRoutingEntrySchema>
export type WorkflowRoutingCatalog = z.infer<typeof workflowRoutingCatalogSchema>

export const autoWorkflowAlternativeSchema = z.object({
  name: z.string(),
  group: z.string(),
  score: z.number(),
})

export const autoWorkflowLlmFailureCodeSchema = z.enum([
  'timeout',
  'invalid-json',
  'invalid-workflow',
  'provider-error',
])

export const autoWorkflowDecisionLlmMetaSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  latencyMs: z.number().optional(),
  failureCode: autoWorkflowLlmFailureCodeSchema.optional(),
})

/** Structured JSON expected from the routing LLM (before validation). */
export const workflowAutoLlmOutputSchema = z.object({
  selectedWorkflow: z.string().trim().min(1),
  group: routingGroupSchema,
  confidence: z.enum(['high', 'medium', 'low']),
  reasonCodes: z.array(z.string()).default([]),
  alternatives: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        group: routingGroupSchema,
      }),
    )
    .max(3)
    .optional(),
})

export type WorkflowAutoLlmOutput = z.infer<typeof workflowAutoLlmOutputSchema>

export const autoWorkflowDecisionSchema = z.object({
  selectedWorkflow: z.string(),
  group: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  score: z.number(),
  fallbackApplied: z.boolean(),
  alternatives: z.array(autoWorkflowAlternativeSchema).max(3),
  reasonCodes: z.array(z.string()),
  llm: autoWorkflowDecisionLlmMetaSchema.optional(),
})

export const enqueueTaskResultSchema = z.object({
  taskId: z.string(),
  autoDecision: autoWorkflowDecisionSchema.optional(),
})
