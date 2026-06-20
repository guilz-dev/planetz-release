import { z } from 'zod'
import { mcpServersFileSchema } from './mcp-server-config.js'

/** Planetz ↔ bundled orbit headless interactive runner contract version. */
export const ORBIT_INTERACTIVE_CONTRACT_VERSION = 1

export const orbitInteractiveChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export const orbitInteractiveWorkflowContextSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  workflowStructure: z.string().optional(),
  stepPreviews: z.array(z.unknown()).optional(),
  taskHistory: z.array(z.unknown()).optional(),
})

export const planetzSessionPolicySchema = z.enum([
  'planetz-task-planning',
  'planetz-chat-investigate',
  'planetz-chat-agent',
  'planetz-chat-spec',
])

export type PlanetzSessionPolicy = z.infer<typeof planetzSessionPolicySchema>

export const orbitInteractiveSnapshotSchema = z.object({
  planetzSessionId: z.string().trim().min(1),
  providerSessionId: z.string().optional(),
  cwd: z.string().trim().min(1),
  workflowId: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  model: z.string().optional(),
  lang: z.enum(['en', 'ja']),
  messages: z.array(orbitInteractiveChatMessageSchema),
  sourceContext: z.string().optional(),
  workflowContext: orbitInteractiveWorkflowContextSchema,
  assistantInitContext: z.string().optional(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
  sessionPolicy: planetzSessionPolicySchema.optional(),
  updatedAt: z.string(),
})

export type OrbitInteractiveSnapshot = z.infer<typeof orbitInteractiveSnapshotSchema>

export const orbitInteractiveToolsProfileSchema = z.enum([
  'readonly',
  'orbit-default',
  'planetz-readonly',
  'planetz-investigate',
  'planetz-agent-edit',
  'planetz-orbit-default',
])

export type OrbitInteractiveToolsProfile = z.infer<typeof orbitInteractiveToolsProfileSchema>

export const orbitInteractiveStartPayloadSchema = z.object({
  cwd: z.string().trim().min(1),
  workflow: z.string().trim().min(1),
  planetzSessionId: z.string().trim().min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
  seedBody: z.string().optional(),
  sourceContext: z.string().optional(),
  sessionPolicy: planetzSessionPolicySchema.optional(),
  toolsProfile: orbitInteractiveToolsProfileSchema.optional(),
  mcpServers: mcpServersFileSchema.optional(),
  allowedToolsOverride: z.array(z.string().trim().min(1)).optional(),
})

export const orbitInteractiveTurnPayloadSchema = z.object({
  message: z.string().trim().min(1),
})

export const orbitInteractiveFinalizePayloadSchema = z.object({
  note: z.string().optional(),
})

export const orbitInteractivePlayPayloadSchema = z.object({
  task: z.string().trim().min(1),
})

export const orbitInteractiveOpSchema = z.enum([
  'start',
  'turn',
  'finalize',
  'accept',
  'play',
  'cancel',
])

export type OrbitInteractiveOp = z.infer<typeof orbitInteractiveOpSchema>

export const orbitInteractiveRequestSchema = z.object({
  contractVersion: z.literal(ORBIT_INTERACTIVE_CONTRACT_VERSION),
  op: orbitInteractiveOpSchema,
  snapshot: orbitInteractiveSnapshotSchema.nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type OrbitInteractiveRequest = z.infer<typeof orbitInteractiveRequestSchema>

export const orbitInteractiveSummaryResultSchema = z.object({
  kind: z.literal('summary'),
  task: z.string(),
  allowedActions: z.array(z.enum(['execute', 'save_task', 'continue'])),
})

export const orbitInteractiveAssistantResultSchema = z.object({
  kind: z.literal('assistant_message'),
  assistantMessage: z.string(),
})

export const orbitInteractiveAcceptResultSchema = z.object({
  kind: z.literal('accept'),
  task: z.string(),
  allowedActions: z.array(z.enum(['execute', 'save_task'])),
})

export const orbitInteractivePlayResultSchema = z.object({
  kind: z.literal('play'),
  task: z.string(),
  allowedActions: z.array(z.enum(['execute', 'save_task'])),
})

export const orbitInteractiveErrorResultSchema = z.object({
  kind: z.literal('error'),
  error: z.string(),
  reason: z.string().optional(),
})

export const orbitInteractiveResultSchema = z.discriminatedUnion('kind', [
  orbitInteractiveAssistantResultSchema,
  orbitInteractiveSummaryResultSchema,
  orbitInteractiveAcceptResultSchema,
  orbitInteractivePlayResultSchema,
  orbitInteractiveErrorResultSchema,
])

export const orbitInteractiveResponseSchema = z.object({
  contractVersion: z.literal(ORBIT_INTERACTIVE_CONTRACT_VERSION),
  ok: z.boolean(),
  result: orbitInteractiveResultSchema.optional(),
  error: z.string().optional(),
  nextSnapshot: orbitInteractiveSnapshotSchema.nullable().optional(),
})

export type OrbitInteractiveResponse = z.infer<typeof orbitInteractiveResponseSchema>

export function isOrbitInteractiveAssistEnabled(): boolean {
  return process.env.PLANETZ_INTERACTIVE_ASSIST === '1'
}

export function resolveOrbitInteractiveToolsProfile(): 'readonly' | 'orbit-default' {
  const raw = process.env.PLANETZ_INTERACTIVE_ASSIST_TOOLS?.trim()
  if (raw === 'orbit-default') return 'orbit-default'
  return 'readonly'
}
