import { z } from 'zod'
import { AVAILABLE_THEME_IDS } from './constants.js'
import { integrationAdapterIdSchema } from './integration-adapter-id-schema.js'
import { orbitInteractiveSnapshotSchema } from './orbit-interactive-contract.js'
import {
  lastSelectedModelByProviderSchema,
  normalizeLastSelectedModelByProvider,
} from './provider-model-selection-state.js'
import { providerSelectionSchema } from './provider-selection-schema.js'
import { normalizeUiBlock, UI_LANGUAGE_IDS } from './ui-config-ui.js'
import { OLLAMA_TOOLS_GUARD_MODES } from './ui-ollama-settings.js'
import { autoWorkflowDecisionSchema } from './workflow-auto-routing-schema.js'

export const uiConfigSchema = z.object({
  taktDir: z.string().min(1),
  taktConfigPath: z.string().min(1),
  workflowsDir: z.string().min(1),
  facetsDir: z.string().min(1),
  tasksYamlPath: z.string().min(1),
  tasksDir: z.string().min(1),
  runsDir: z.string().min(1),
  watch: z.object({
    autoStart: z.boolean(),
  }),
  ui: z.preprocess(
    (raw) => normalizeUiBlock(raw),
    z.object({
      theme: z.enum(AVAILABLE_THEME_IDS),
      counterPackEnabled: z.boolean(),
      language: z.enum(UI_LANGUAGE_IDS),
      laneSpeed: z.enum(['slow', 'normal', 'fast']),
      composerAssistDefaultMode: z.enum(['direct', 'assist']),
      providerSelection: providerSelectionSchema.optional(),
      ollama: z
        .object({
          toolsGuard: z.enum(OLLAMA_TOOLS_GUARD_MODES),
        })
        .optional(),
      workflowLowConfidenceGateEnabled: z.boolean().default(false),
      workflowLibrary: z.object({
        enabledPacks: z.array(z.string()),
        enabledWorkflows: z.array(z.string()),
        autoEnabledWorkflows: z.array(z.string()),
        implicitEnabledWorkflows: z.array(z.string()),
        dismissedImplicitWorkflows: z.array(z.string()),
      }),
      pinnedWorkflows: z.array(z.string()),
      hiddenCoreWorkflows: z.array(z.string()),
    }),
  ),
  integrations: z
    .object({
      hookServer: z.object({
        enabled: z.boolean(),
        port: z.number().int().min(1).max(65_535),
      }),
      adapters: z.array(
        z.object({
          id: integrationAdapterIdSchema,
          enabled: z.boolean(),
        }),
      ),
    })
    .optional(),
})

export const uiStateSchema = z.object({
  selectedTaskId: z.string().optional(),
  taskAssignments: z.record(z.string(), z.string()).optional(),
  activeRunByTaskId: z.record(z.string(), z.string()).optional(),
  lastSelectedModelByProvider: z.preprocess(
    normalizeLastSelectedModelByProvider,
    lastSelectedModelByProviderSchema.optional(),
  ),
  canonicalImportPromptSeen: z.boolean().optional(),
  panelOpen: z
    .object({
      detail: z.boolean().optional(),
      retry: z.boolean().optional(),
      result: z.boolean().optional(),
    })
    .optional(),
})

export const promptHistoryItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  workflow: z.string().optional(),
  autoDecision: autoWorkflowDecisionSchema.optional(),
  assignedAgentId: z.string().optional(),
  issueRef: z.string().trim().min(1).optional(),
  submittedTaskId: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'discarded']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const promptHistorySchema = z.object({
  items: z.array(promptHistoryItemSchema),
})

const composerAssistChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export const composerAssistTurnRecordSchema = z.object({
  question: z.string().trim().min(1),
  recommendedAnswer: z.string().trim().min(1),
  userReply: z.string().optional(),
})

/** Persisted Composer Assist draft — legacy planning-only Q/A flow. */
export const composerAssistPlanningSnapshotSchema = z.object({
  sessionId: z.string().trim().min(1),
  mode: z.literal('planning-only'),
  workflow: z.string().optional(),
  provider: z.string().trim().min(1),
  model: z.string().optional(),
  effort: z.string().optional(),
  seedBody: z.string().optional(),
  messages: z.array(composerAssistChatMessageSchema),
  assistantTurnCount: z.number().int().nonnegative(),
  turns: z.array(composerAssistTurnRecordSchema),
  readyToFinalize: z.boolean(),
  updatedAt: z.string(),
})

/** Persisted headless orbit interactive session. */
export const composerAssistInteractiveSnapshotSchema = z.object({
  sessionId: z.string().trim().min(1),
  mode: z.literal('interactive-assistant'),
  workflow: z.string().optional(),
  provider: z.string().trim().min(1),
  model: z.string().optional(),
  effort: z.string().optional(),
  seedBody: z.string().optional(),
  orbitSnapshot: orbitInteractiveSnapshotSchema,
  readyToFinalize: z.boolean(),
  updatedAt: z.string(),
})

/** Persisted Composer Assist draft (sidecar kv_store). */
export const composerAssistSessionSnapshotSchema = z.discriminatedUnion('mode', [
  composerAssistPlanningSnapshotSchema,
  composerAssistInteractiveSnapshotSchema,
])

export type ComposerAssistSessionSnapshot = z.infer<typeof composerAssistSessionSnapshotSchema>

/** Aggregated Composer Assist outcome counters (sidecar kv_store). */
export const composerAssistMetricsSchema = z.object({
  startAttempts: z.number().int().nonnegative(),
  startSuccesses: z.number().int().nonnegative(),
  startTimeouts: z.number().int().nonnegative(),
  startErrors: z.number().int().nonnegative(),
  messageAttempts: z.number().int().nonnegative(),
  messageSuccesses: z.number().int().nonnegative(),
  messageTimeouts: z.number().int().nonnegative(),
  messageErrors: z.number().int().nonnegative(),
  finalizeAttempts: z.number().int().nonnegative(),
  finalizeSuccesses: z.number().int().nonnegative(),
  finalizeTimeouts: z.number().int().nonnegative(),
  finalizeErrors: z.number().int().nonnegative(),
  updatedAt: z.string(),
})

export type ComposerAssistMetrics = z.infer<typeof composerAssistMetricsSchema>

/** v0.1 local mock queue persisted in sidecar (§19: sidecar / local queue). */
export const mockTaskViewModelSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string().optional(),
  issueRef: z.string().trim().min(1).optional(),
  issueNumber: z.number().int().positive().optional(),
  workflow: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['pending', 'running', 'stopped', 'completed', 'failed', 'exceeded']),
  assignedAgentId: z.string().optional(),
  source: z.enum(['user', 'takt', 'external']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const mockQueueSchema = z.object({
  tasks: z.array(mockTaskViewModelSchema),
})

export const conversationEntrySchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  role: z.enum(['user', 'system']),
  kind: z.enum(['initial_order', 'retry', 'resume', 'revise', 'note']),
  body: z.string(),
  createdAt: z.string(),
})

export const conversationsFileSchema = z.object({
  entries: z.array(conversationEntrySchema),
})

export const retryContextSchema = z.object({
  taskId: z.string().min(1),
  originTaskId: z.string().min(1),
  kind: z.enum(['retry', 'resume', 'revise']),
  prompt: z.string().optional(),
  branch: z.string().optional(),
  createdAt: z.string(),
})

export const retryContextsFileSchema = z.object({
  contexts: z.array(retryContextSchema),
})

export const chainPlannedTaskSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  workflow: z.string().optional(),
  mode: z.enum(['branch_handoff', 'merge_then_continue']),
  sourceBranch: z.string().optional(),
  baseBranch: z.string().optional(),
})

export const chainEdgeSchema = z
  .object({
    fromTaskId: z.string().min(1),
    toTaskId: z.string().min(1).optional(),
    planned: chainPlannedTaskSchema.optional(),
    mode: z.enum(['branch_handoff', 'merge_then_continue']).optional(),
    status: z.enum(['waiting_for_dependency', 'ready_to_create', 'created', 'blocked', 'invalid']),
    sourceBranch: z.string().optional(),
    baseBranch: z.string().optional(),
  })
  .superRefine((edge, ctx) => {
    const pending = edge.toTaskId === undefined
    if (pending && !edge.planned) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'planned is required when toTaskId is omitted',
        path: ['planned'],
      })
    }
    if (!pending && edge.mode === undefined && edge.planned?.mode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mode is required when toTaskId is set',
        path: ['mode'],
      })
    }
  })

export const chainGroupFileSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  taskIds: z.array(z.string()),
  edges: z.array(chainEdgeSchema),
})

export const chainsFileSchema = z.object({
  chains: z.array(chainGroupFileSchema),
})

export const watchStateFileSchema = z.object({
  pid: z.number().int().optional(),
  startedAt: z.string().optional(),
  lastError: z.string().optional(),
})

export type UiConfig = z.infer<typeof uiConfigSchema>
export type UiState = z.infer<typeof uiStateSchema>
export type PromptHistoryFile = z.infer<typeof promptHistorySchema>
