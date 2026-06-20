import { z } from 'zod'
import { agentOverridesSchema } from './agent-overrides-schema.js'
import { chatComposerDraftSnapshotSchema } from './chat-composer-draft.js'
import { chatToTaskMetricRecordInputSchema } from './chat-to-task-metrics.js'
import { normalizeComposerAssistSourceContext } from './composer-source-context.js'
import { AVAILABLE_THEME_IDS, MAX_RECENT_WORKFLOWS } from './constants.js'
import { artifactRefSchema } from './conversation-artifact-types.js'
import { engineConfigSchema } from './engine-config-schema.js'
import { FACET_KINDS } from './facet-types.js'
import { integrationAdapterIdSchema } from './integration-adapter-id-schema.js'
import { intentDraftSchema } from './intent-draft.js'
import { planetzSessionPolicySchema } from './orbit-interactive-contract.js'
import { providerSelectionSchema } from './provider-selection-schema.js'
import { UI_LANGUAGE_IDS } from './ui-config-ui.js'
import { OLLAMA_TOOLS_GUARD_MODES } from './ui-ollama-settings.js'
import {
  taskSwapWorkflowInputSchema,
  taskSwapWorkflowResultSchema,
  workflowAutoRoutePreviewResultSchema,
  workflowGetPreviewInputSchema,
  workflowPreviewAutoRouteInputSchema,
  workflowPreviewResultSchema,
  workflowRunOverrideSchema,
  workflowSelectionKindSchema,
} from './workflow-selection-schema.js'

export {
  taskSwapWorkflowInputSchema,
  taskSwapWorkflowResultSchema,
  workflowAutoRoutePreviewResultSchema,
  workflowGetPreviewInputSchema,
  workflowPreviewAutoRouteInputSchema,
  workflowPreviewResultSchema,
  workflowRunOverrideSchema,
  workflowSelectionKindSchema,
}

export const enqueueTaskInputSchema = z.object({
  workspaceId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  issueRef: z.string().trim().min(1).optional(),
  issueNumber: z.number().int().positive().optional(),
  workflow: z.string().trim().min(1).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedAgentId: z.string().optional(),
  provider: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  /** Originating conversation thread; persisted as a task<->thread link for Spec Studio. */
  sourceThreadId: z.string().trim().min(1).optional(),
})

/**
 * Renderer bridge accepts missing `title` for PromptComposer v2.
 * Main process backfills a title before persisting/executing.
 */
const workflowModeSchema = z.enum(['manual', 'auto']).default('manual')

export const enqueueTaskBridgeInputSchema = enqueueTaskInputSchema
  .extend({
    title: z.string().min(1).optional(),
    workflowMode: workflowModeSchema.optional(),
    recentWorkflowNames: z.array(z.string()).max(MAX_RECENT_WORKFLOWS).optional(),
    routingPreviewToken: z.string().trim().min(1).optional(),
    routingPromptHash: z.string().trim().min(1).optional(),
    confirmedWorkflow: z.string().trim().min(1).optional(),
    runOverride: workflowRunOverrideSchema.optional(),
    workflowSelectionKind: workflowSelectionKindSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const mode = input.workflowMode ?? 'manual'
    if (mode === 'manual') {
      const workflow = input.workflow?.trim() ?? ''
      if (workflow.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'workflow is required when workflowMode is manual',
          path: ['workflow'],
        })
      }
    }
  })

export const selectTaskInputSchema = z.object({
  /** Empty string clears the current selection. */
  taskId: z.string(),
})

export const promptHistoryDeleteInputSchema = z.object({
  id: z.string().min(1),
})

export const promptHistoryListInputSchema = z
  .object({
    workspaceId: z.string().optional(),
    limit: z.number().int().positive().optional(),
  })
  .optional()

export const taskIdInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1),
})

export const taskResultPathOpenActionSchema = z.enum(['open_report', 'reveal_reports_dir'])

export const taskResultPathOpenInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1),
  action: taskResultPathOpenActionSchema,
  relativePath: z.string().min(1).optional(),
})

export type TaskResultPathOpenInput = z.infer<typeof taskResultPathOpenInputSchema>

export const taskPromptInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1),
  prompt: z.string().min(1),
})

export const workflowReadInputSchema = z.object({
  workspaceId: z.string().optional(),
  nameOrPath: z.string().min(1),
  /** When set, read from this scope instead of the highest-precedence match. */
  source: z.enum(['builtin', 'project', 'user']).optional(),
})

export const workflowReadFacetsInputSchema = z.object({
  workspaceId: z.string().optional(),
  managedPaths: z.array(z.string().min(1)),
})

const facetKindSchema = z.enum(FACET_KINDS)

export const facetReadInputSchema = z.object({
  workspaceId: z.string().optional(),
  kind: facetKindSchema,
  key: z.string().min(1),
  source: z.enum(['project', 'builtin', 'user']).optional(),
})

export const facetWriteProjectInputSchema = z.object({
  workspaceId: z.string().optional(),
  kind: facetKindSchema,
  key: z.string().min(1),
  content: z.string(),
})

export const facetDeleteProjectInputSchema = z.object({
  workspaceId: z.string().optional(),
  kind: facetKindSchema,
  key: z.string().min(1),
})

export const facetListUsagesInputSchema = z.object({
  workspaceId: z.string().optional(),
  kind: facetKindSchema,
  key: z.string().min(1),
})

export const workflowWriteProjectInputSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1),
  yaml: z.string(),
  facetFiles: z.record(z.string(), z.string()).optional(),
})

export const workflowValidateInputSchema = z.object({
  workspaceId: z.string().optional(),
  nameOrPath: z.string().min(1),
  yaml: z.string().optional(),
})

export const workflowDraftNameInputSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1),
})

export const workflowDraftSaveInputSchema = workflowDraftNameInputSchema.extend({
  yaml: z.string(),
})

export const workflowDraftLoadInputSchema = workflowDraftNameInputSchema

export const workflowDraftDeleteInputSchema = workflowDraftNameInputSchema

export const workspaceSetBootstrapInputSchema = z.object({
  status: z.enum(['non_takt', 'partial_takt', 'takt_ready']),
})

export const workspaceRecentPathInputSchema = z.object({
  path: z.string().min(1),
})

export const chainCreateInputSchema = z.object({
  fromTaskId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  workflow: z.string().optional(),
  mode: z.enum(['branch_handoff', 'merge_then_continue']),
  sourceBranch: z.string().optional(),
  baseBranch: z.string().optional(),
  chainId: z.string().optional(),
  /** When true (default), only persist `planned` in chains.json until materialize. */
  deferTaskCreation: z.boolean().optional(),
})

export const chainMaterializeInputSchema = z.object({
  chainId: z.string().min(1),
  fromTaskId: z.string().min(1),
})

export const chainCheckBranchInputSchema = z.object({
  branch: z.string().min(1),
})

export const chainDeleteInputSchema = z.object({
  chainId: z.string().min(1),
  edgeKey: z.string().optional(),
})

export const chainSetEdgeStatusInputSchema = z.object({
  chainId: z.string().min(1),
  fromTaskId: z.string().min(1),
  /** Omit for pending edges; delete uses edgeKey `from->__pending__`. */
  toTaskId: z.string().min(1).optional(),
  status: z.enum(['waiting_for_dependency', 'ready_to_create', 'created', 'blocked', 'invalid']),
})

export const integrationsToggleHookServerInputSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(1).max(65_535).optional(),
})

export { integrationAdapterIdSchema } from './integration-adapter-id-schema.js'

export const integrationsToggleAdapterInputSchema = z.object({
  id: integrationAdapterIdSchema,
  enabled: z.boolean(),
})

export const integrationsPushExternalInputSchema = z.object({
  id: integrationAdapterIdSchema,
})

export const resultBranchInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1),
  branch: z.string().min(1),
})

export const resultDiffFileInputSchema = resultBranchInputSchema.extend({
  path: z.string().min(1),
})

export {
  createResultPrResultSchema,
  taskPrErrorCodeSchema,
  taskPrSummarySchema,
} from './task-pr-types.js'

export const createResultPrInputSchema = z.object({
  workspaceId: z.string().optional(),
  taskId: z.string().min(1),
  branch: z.string().min(1),
  baseBranch: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
  pushIfNeeded: z.boolean().optional(),
})

export const resultCheckBranchInputSchema = resultBranchInputSchema

export const resultCheckBranchResultSchema = z.object({
  exists: z.boolean(),
  defaultBaseBranch: z.string().min(1).optional(),
})

export const workspaceInitializeInputSchema = z.object({
  createTaktDir: z.boolean(),
})

export const workspaceCurrentGitBranchResultSchema = z.object({
  branch: z.string().trim().min(1).nullable(),
})

export const workspaceGitBranchesResultSchema = z.object({
  branches: z.array(z.string().trim().min(1)),
  currentBranch: z.string().trim().min(1).nullable(),
})

export const engineConfigUpdateInputSchema = engineConfigSchema.partial()

export const engineConfigImportInputSchema = z.object({
  workspaceId: z.string().optional(),
  overwrite: z.boolean().optional(),
})

export const yamlOpenTargetSchema = z.enum(['engine-config', 'agent-overrides', 'workflow'])

export const yamlOpenInputSchema = z.object({
  workspaceId: z.string().optional(),
  target: yamlOpenTargetSchema,
  workflowName: z.string().trim().min(1).optional(),
})

export const yamlOpenResultSchema = z.object({
  status: z.enum(['opened', 'not_found', 'denied', 'failed']),
  path: z.string().optional(),
  message: z.string().optional(),
})

export const taskOpenWorkDirResultSchema = yamlOpenResultSchema

export type TaskOpenWorkDirResult = z.infer<typeof taskOpenWorkDirResultSchema>

export const agentOverridesUpdateInputSchema = agentOverridesSchema

export const workflowImportFromTaktInputSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1),
  overwrite: z.boolean().optional(),
})

export const settingsUpdateInputSchema = z.object({
  watch: z
    .object({
      autoStart: z.boolean(),
    })
    .optional(),
  ui: z
    .object({
      theme: z.enum(AVAILABLE_THEME_IDS).optional(),
      counterPackEnabled: z.boolean().optional(),
      language: z.enum(UI_LANGUAGE_IDS).optional(),
      laneSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
      composerAssistDefaultMode: z.enum(['direct', 'assist']).optional(),
      providerSelection: providerSelectionSchema.optional(),
      ollama: z
        .object({
          toolsGuard: z.enum(OLLAMA_TOOLS_GUARD_MODES).optional(),
        })
        .optional(),
      workflowLowConfidenceGateEnabled: z.boolean().optional(),
      workflowLibrary: z
        .object({
          enabledPacks: z.array(z.string()).optional(),
          enabledWorkflows: z.array(z.string()).optional(),
          autoEnabledWorkflows: z.array(z.string()).optional(),
          implicitEnabledWorkflows: z.array(z.string()).optional(),
          dismissedImplicitWorkflows: z.array(z.string()).optional(),
        })
        .optional(),
      pinnedWorkflows: z.array(z.string()).optional(),
      hiddenCoreWorkflows: z.array(z.string()).optional(),
    })
    .optional(),
})

export const listProviderModelsInputSchema = z.object({
  workspaceId: z.string().optional(),
  provider: z.string().trim().min(1),
  currentModel: z.string().trim().optional(),
  workflowName: z.string().trim().optional(),
  refresh: z.boolean().optional(),
  /** Unsaved engine form snapshot; merged over persisted config for discovery only. */
  engineConfigPreview: engineConfigSchema.optional(),
})

export const listModelHistoryInputSchema = z
  .object({
    workspaceId: z.string().optional(),
    provider: z.string().trim().min(1).optional(),
  })
  .optional()

export const deleteModelHistoryItemInputSchema = z.object({
  workspaceId: z.string().optional(),
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
})

export const rememberProviderModelSelectionInputSchema = z.object({
  workspaceId: z.string().optional(),
  provider: z.string().trim().min(1),
  model: z.string().trim().optional(),
})

export const listProviderEffortsInputSchema = z.object({
  workspaceId: z.string().optional(),
  provider: z.string().trim().min(1),
  currentEffort: z.string().trim().optional(),
  workflowName: z.string().trim().optional(),
  refresh: z.boolean().optional(),
})

export const listEffortHistoryInputSchema = z
  .object({
    workspaceId: z.string().optional(),
    provider: z.string().trim().min(1).optional(),
  })
  .optional()

export const deleteEffortHistoryItemInputSchema = z.object({
  workspaceId: z.string().optional(),
  provider: z.string().trim().min(1),
  effort: z.string().trim().min(1),
})

export const canonicalImportConfirmInputSchema = z.object({
  importHomeGlobal: z.boolean().optional(),
})

export const taktGlobalImportFromHomeInputSchema = z.object({
  overwrite: z.boolean().optional(),
})

export const composerSessionModeSchema = z.enum(['planning-only', 'interactive-assistant'])

export type ComposerSessionMode = z.infer<typeof composerSessionModeSchema>

export const composerAssistCapabilitiesSchema = z.object({
  startMode: composerSessionModeSchema,
  headlessRunnerReady: z.boolean(),
})

export const composerSessionStartInputSchema = z.object({
  mode: composerSessionModeSchema,
  seedBody: z.string().optional(),
  /** Untrusted Issue/PR reference text for orbit interactive source context. */
  sourceContext: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : normalizeComposerAssistSourceContext(value),
    ),
  workflow: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().trim().min(1).optional(),
  /** When true, discard any persisted draft and start a new session. */
  forceNew: z.boolean().optional(),
  sessionPolicy: planetzSessionPolicySchema.optional(),
  /** When set, main creates a conversation ledger thread on successful start (Chat View). */
  conversationLedger: z
    .object({
      workspacePath: z.string().trim().min(1),
      branch: z.string().trim().min(1).optional(),
      title: z.string().optional(),
      /** When set, rebind an open ledger thread to a new composer session instead of inserting a row. */
      existingThreadId: z.string().trim().min(1).optional(),
    })
    .optional(),
})

export const composerSessionMessageInputSchema = z.object({
  sessionId: z.string().trim().min(1),
  message: z.string().trim().min(1),
  /** Artifact references; payloads live in `conversation_artifacts` (main). */
  attachments: z.array(artifactRefSchema).optional(),
})

export const composerSessionFinalizeInputSchema = z.object({
  sessionId: z.string().trim().min(1),
})

export const composerSessionAcceptInputSchema = z.object({
  sessionId: z.string().trim().min(1),
})

export const composerSessionPlayInputSchema = z.object({
  sessionId: z.string().trim().min(1),
  task: z.string().trim().min(1),
})

export const composerSourceContextBuildInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('issue'),
    ref: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal('pr'),
    repository: z.object({
      owner: z.string().trim().min(1),
      name: z.string().trim().min(1),
    }),
    number: z.number().int().positive(),
    title: z.string().trim().min(1),
    url: z.string().url(),
    body: z.string().optional(),
  }),
])

export const composerSourceContextBuildResultSchema = z.object({
  sourceContext: z.string().trim().min(1),
})

export const composerSessionCancelInputSchema = z.object({
  sessionId: z.string().trim().min(1),
})

export const composerSessionInterruptInputSchema = z.object({
  sessionId: z.string().trim().min(1),
})

export const composerSessionResumeInputSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
})

export const chatGatewayCapabilitySchema = z.enum(['auto', 'mock', 'orbit'])

export const chatAgentProviderSupportSchema = z.enum(['unsupported', 'readonly', 'edit'])

export type ChatAgentProviderSupport = z.infer<typeof chatAgentProviderSupportSchema>

export const desktopCapabilitiesResultSchema = z.object({
  conversationModeEnabled: z.boolean(),
  chatGateway: chatGatewayCapabilitySchema.default('auto'),
  devProvidersAvailable: z.boolean().default(false),
  chatAgentEnabled: z.boolean().default(true),
  chatAgentSupportByProvider: z.record(z.string(), chatAgentProviderSupportSchema).optional(),
  chatMcpEnabledByProvider: z.record(z.string(), z.boolean()).optional(),
})

export const conversationHistoryThreadSummarySchema = z.object({
  threadId: z.string().trim().min(1),
  title: z.string(),
  workspacePath: z.string().trim().min(1),
  workspaceLabel: z.string(),
  updatedAt: z.string().trim().min(1),
  hasActiveSession: z.boolean(),
  /** Present when `hasActiveSession` is true; used to resume via composerSession:resume. */
  activeSessionId: z.string().trim().min(1).optional(),
  sessionPolicy: planetzSessionPolicySchema.optional(),
})

export const conversationHistoryTurnSchema = z.object({
  turnId: z.string().trim().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string().trim().min(1),
})

const conversationHistoryWorkspacePathField = z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe('Ignored; the currently open workspace is always used.')

export const conversationHistoryListInputSchema = z
  .object({
    workspacePath: conversationHistoryWorkspacePathField,
    limit: z.number().int().positive().max(500).optional(),
  })
  .optional()

export const conversationHistoryListResultSchema = z.object({
  threads: z.array(conversationHistoryThreadSummarySchema),
})

export const conversationHistoryGetInputSchema = z.object({
  threadId: z.string().trim().min(1),
})

export const conversationHistoryGetResultSchema = z.discriminatedUnion('found', [
  z.object({
    found: z.literal(false),
  }),
  z.object({
    found: z.literal(true),
    thread: conversationHistoryThreadSummarySchema,
    turns: z.array(conversationHistoryTurnSchema),
  }),
])

export const conversationHistoryDeleteInputSchema = z.object({
  threadId: z.string().trim().min(1),
})

export const conversationHistoryDeleteResultSchema = z.object({
  ok: z.literal(true),
  deleted: z.boolean(),
})

export const conversationHistorySearchInputSchema = z.object({
  query: z.string().trim().min(1),
  workspacePath: conversationHistoryWorkspacePathField,
  limit: z.number().int().positive().max(500).optional(),
})

export const conversationHistorySearchResultSchema = z.object({
  threads: z.array(conversationHistoryThreadSummarySchema),
})

export const chatComposerDraftGetResultSchema = z.object({
  snapshot: chatComposerDraftSnapshotSchema.nullable(),
})

export const chatComposerDraftSaveInputSchema = chatComposerDraftSnapshotSchema

export const chatComposerDraftSaveResultSchema = z.object({
  ok: z.literal(true),
})

export const intentDraftGetResultSchema = z.object({
  draft: intentDraftSchema.nullable(),
})

export const intentDraftSaveResultSchema = z.object({
  draft: intentDraftSchema,
})

export const intentDraftGenerateResultSchema = z.object({
  draft: intentDraftSchema.nullable(),
})

export const intentDraftClearResultSchema = z.object({
  ok: z.literal(true),
})

export { chatToTaskMetricRecordInputSchema }

export const ollamaHealthGetInputSchema = z
  .object({
    workspaceId: z.string().optional(),
    engineConfigPreview: engineConfigSchema.optional(),
  })
  .optional()

export const ollamaExecutionGuardPreviewInputSchema = enqueueTaskBridgeInputSchema

export const ollamaModelAdminInputSchema = z.object({
  workspaceId: z.string().optional(),
  model: z.string().trim().min(1),
  engineConfigPreview: engineConfigSchema.optional(),
})

export type EnqueueTaskInput = z.infer<typeof enqueueTaskInputSchema>
export type EnqueueTaskBridgeInput = z.infer<typeof enqueueTaskBridgeInputSchema>
export type ResultDiffFileInput = z.infer<typeof resultDiffFileInputSchema>
export type CreateResultPrInput = z.infer<typeof createResultPrInputSchema>
export type ResultCheckBranchInput = z.infer<typeof resultCheckBranchInputSchema>
export type ResultCheckBranchResult = z.infer<typeof resultCheckBranchResultSchema>
export type SettingsUpdateInput = z.infer<typeof settingsUpdateInputSchema>
export type EngineConfigUpdateInput = z.infer<typeof engineConfigUpdateInputSchema>
export type EngineConfigImportInput = z.infer<typeof engineConfigImportInputSchema>
export type YamlOpenInput = z.infer<typeof yamlOpenInputSchema>
export type YamlOpenResult = z.infer<typeof yamlOpenResultSchema>
export type AgentOverridesUpdateInput = z.infer<typeof agentOverridesUpdateInputSchema>
export type WorkflowImportFromTaktInput = z.infer<typeof workflowImportFromTaktInputSchema>
export type ListProviderModelsInput = z.infer<typeof listProviderModelsInputSchema>
export type ListModelHistoryInput = z.infer<typeof listModelHistoryInputSchema>
export type DeleteModelHistoryItemInput = z.infer<typeof deleteModelHistoryItemInputSchema>
export type RememberProviderModelSelectionInput = z.infer<
  typeof rememberProviderModelSelectionInputSchema
>
export type ListProviderEffortsInput = z.infer<typeof listProviderEffortsInputSchema>
export type ListEffortHistoryInput = z.infer<typeof listEffortHistoryInputSchema>
export type DeleteEffortHistoryItemInput = z.infer<typeof deleteEffortHistoryItemInputSchema>
export type CanonicalImportConfirmInput = z.infer<typeof canonicalImportConfirmInputSchema>
export type TaktGlobalImportFromHomeInput = z.infer<typeof taktGlobalImportFromHomeInputSchema>
export type ComposerAssistCapabilities = z.infer<typeof composerAssistCapabilitiesSchema>
/** Wire/input shape before IPC parse (optional fields stay optional). */
export type ComposerSessionStartInput = z.input<typeof composerSessionStartInputSchema>
/** Normalized shape after `composerSessionStartInputSchema.parse`. */
export type ComposerSessionStartParsed = z.output<typeof composerSessionStartInputSchema>
export type ComposerSessionMessageInput = z.infer<typeof composerSessionMessageInputSchema>
export type ComposerSessionFinalizeInput = z.infer<typeof composerSessionFinalizeInputSchema>
export type ComposerSessionAcceptInput = z.infer<typeof composerSessionAcceptInputSchema>
export type ComposerSessionPlayInput = z.infer<typeof composerSessionPlayInputSchema>
export type ComposerSourceContextBuildInput = z.infer<typeof composerSourceContextBuildInputSchema>
export type ComposerSourceContextBuildResult = z.infer<
  typeof composerSourceContextBuildResultSchema
>
export type ComposerSessionCancelInput = z.infer<typeof composerSessionCancelInputSchema>
export type ComposerSessionInterruptInput = z.infer<typeof composerSessionInterruptInputSchema>
export type ComposerSessionResumeInput = z.infer<typeof composerSessionResumeInputSchema>
export type DesktopCapabilitiesResult = z.infer<typeof desktopCapabilitiesResultSchema>
export type ConversationHistoryThreadSummary = z.infer<
  typeof conversationHistoryThreadSummarySchema
>
export type ConversationHistoryTurn = z.infer<typeof conversationHistoryTurnSchema>
export type ConversationHistoryListInput = z.infer<typeof conversationHistoryListInputSchema>
export type ConversationHistoryListResult = z.infer<typeof conversationHistoryListResultSchema>
export type ConversationHistoryGetInput = z.infer<typeof conversationHistoryGetInputSchema>
export type ConversationHistoryGetResult = z.infer<typeof conversationHistoryGetResultSchema>
export type ConversationHistoryDeleteInput = z.infer<typeof conversationHistoryDeleteInputSchema>
export type ConversationHistoryDeleteResult = z.infer<typeof conversationHistoryDeleteResultSchema>
export type ConversationHistorySearchInput = z.infer<typeof conversationHistorySearchInputSchema>
export type ConversationHistorySearchResult = z.infer<typeof conversationHistorySearchResultSchema>
export type ChatComposerDraftGetResult = z.infer<typeof chatComposerDraftGetResultSchema>
export type ChatComposerDraftSaveInput = z.infer<typeof chatComposerDraftSaveInputSchema>
export type ChatComposerDraftSaveResult = z.infer<typeof chatComposerDraftSaveResultSchema>
export type IntentDraftGetResult = z.infer<typeof intentDraftGetResultSchema>
export type IntentDraftSaveResult = z.infer<typeof intentDraftSaveResultSchema>
export type IntentDraftGenerateResult = z.infer<typeof intentDraftGenerateResultSchema>
export type IntentDraftClearResult = z.infer<typeof intentDraftClearResultSchema>
export type OllamaHealthGetInput = z.infer<typeof ollamaHealthGetInputSchema>
export type OllamaExecutionGuardPreviewInput = z.infer<
  typeof ollamaExecutionGuardPreviewInputSchema
>
export type OllamaModelAdminInput = z.infer<typeof ollamaModelAdminInputSchema>

const executionAnalyticsWindowSchema = z.enum(['24h', '7d', '30d', 'all'])

const executionLogEventTypeFilterSchema = z.enum([
  'all',
  'step_start',
  'step_complete',
  'workflow_complete',
  'workflow_abort',
  'log',
])

const executionLogTaskStatusFilterSchema = z.enum([
  'all',
  'pending',
  'running',
  'stopped',
  'completed',
  'failed',
  'exceeded',
])

export const executionLogListInputSchema = z
  .object({
    keyword: z.string().optional(),
    window: executionAnalyticsWindowSchema.optional(),
    eventType: executionLogEventTypeFilterSchema.optional(),
    taskStatus: executionLogTaskStatusFilterSchema.optional(),
    executorId: z.union([z.literal('all'), z.string().min(1)]).optional(),
    runId: z.string().min(1).optional(),
    cursor: z.string().min(1).optional(),
    limit: z.number().int().positive().max(2000).optional(),
  })
  .optional()

export const executionSummaryGetInputSchema = z
  .object({
    window: executionAnalyticsWindowSchema.optional(),
  })
  .optional()

export type ExecutionLogListInput = z.infer<typeof executionLogListInputSchema>
export type ExecutionSummaryGetInput = z.infer<typeof executionSummaryGetInputSchema>

export const intentLedgerListPendingInputSchema = z
  .object({
    expensiveOnly: z.boolean().optional(),
    taskId: z.string().min(1).optional(),
  })
  .optional()

export const intentLedgerCountPendingInputSchema = intentLedgerListPendingInputSchema

export const intentLedgerGetSummaryInputSchema = z
  .object({
    window: executionAnalyticsWindowSchema.optional(),
    expensiveOnly: z.boolean().optional(),
  })
  .optional()

export const intentLedgerListByThreadInputSchema = z.object({
  threadId: z.string().min(1),
})

export const intentLedgerEntryIdInputSchema = z.object({
  entryId: z.string().min(1),
})

export const intentLedgerAdoptInputSchema = z.object({
  entryId: z.string().min(1),
  reason: z.string().optional(),
})

export const intentLedgerFixInputSchema = z.object({
  entryId: z.string().min(1),
  reason: z.string().optional(),
})

export type IntentLedgerListPendingInput = z.infer<typeof intentLedgerListPendingInputSchema>
export type IntentLedgerCountPendingInput = z.infer<typeof intentLedgerCountPendingInputSchema>
export type IntentLedgerGetSummaryInput = z.infer<typeof intentLedgerGetSummaryInputSchema>
export type IntentLedgerListByThreadInput = z.infer<typeof intentLedgerListByThreadInputSchema>
export type IntentLedgerEntryIdInput = z.infer<typeof intentLedgerEntryIdInputSchema>
export type IntentLedgerAdoptInput = z.infer<typeof intentLedgerAdoptInputSchema>
export type IntentLedgerFixInput = z.infer<typeof intentLedgerFixInputSchema>

export { ValidationCoverageSummarySchema as validationCoverageSummarySchema } from './validation-coverage.js'
export type ValidationCoverageGetSummaryResult = z.infer<
  typeof import('./validation-coverage.js').ValidationCoverageSummarySchema
>

export {
  type ChatApplyEventPayload,
  type ChatApplySessionMeta,
  type ChatApplySkipReason,
  type ChatSessionApplyChangesInput,
  type ChatSessionApplyChangesResult,
  type ChatSessionPendingChangeFileInput,
  type ChatSessionPendingChangeFileResult,
  type ChatSessionPendingChangesResult,
  type ChatSessionPendingFile,
  type ChatSessionThreadInput,
  chatApplyEventPayloadSchema,
  chatApplySessionMetaSchema,
  chatApplySkipReasonSchema,
  chatSessionApplyChangesInputSchema,
  chatSessionApplyChangesResultSchema,
  chatSessionApplySkippedSchema,
  chatSessionApplyStrategySchema,
  chatSessionPendingChangeFileInputSchema,
  chatSessionPendingChangeFileResultSchema,
  chatSessionPendingChangesResultSchema,
  chatSessionPendingFileSchema,
  chatSessionThreadInputSchema,
} from './chat-session-apply.js'
export {
  decidedIntentSaveInputSchema,
  decidedIntentThreadInputSchema,
} from './decided-intent.js'
export {
  type GitHubIssueFetchInput,
  type GitHubIssueListItem,
  type GitHubIssueListOpenInput,
  type GitHubIssueListOpenResult,
  type GitHubIssueView,
  githubIssueFetchInputSchema,
  githubIssueListItemSchema,
  githubIssueListOpenInputSchema,
  githubIssueListOpenResultSchema,
  githubIssueViewSchema,
} from './github-issue-types.js'
export {
  intentDraftGenerateInputSchema,
  intentDraftSaveInputSchema,
  intentDraftThreadInputSchema,
} from './intent-draft.js'
export type { KiroSpecGetInput } from './kiro-spec-contract.js'
export { KiroSpecGetInputSchema as kiroSpecGetInputSchema } from './kiro-spec-contract.js'
export {
  type ChatMcpGrantConsentInput,
  type ChatMcpPendingConsentResult,
  type ChatMcpSecretStorage,
  type ChatMcpServerSummary,
  type ChatMcpServersOverviewResult,
  type ChatMcpSetSecretInput,
  type ChatMcpSetSecretResult,
  type ChatMcpTransport,
  chatMcpGrantConsentInputSchema,
  chatMcpPendingConsentResultSchema,
  chatMcpSecretStorageSchema,
  chatMcpServerSummarySchema,
  chatMcpServersOverviewResultSchema,
  chatMcpSetSecretInputSchema,
  chatMcpSetSecretResultSchema,
  chatMcpTransportSchema,
  type McpHttpServerConfig,
  type McpPolicyFile,
  type McpPolicyServerEntry,
  type McpServerConfig,
  type McpServersFile,
  type McpSseServerConfig,
  type McpStdioServerConfig,
  mcpHttpServerConfigSchema,
  mcpPolicyFileSchema,
  mcpPolicyServerEntrySchema,
  mcpServerConfigSchema,
  mcpServersFileSchema,
  mcpSseServerConfigSchema,
  mcpStdioServerConfigSchema,
} from './mcp-server-config.js'
export { specThreadSummaryListInputSchema } from './spec-thread-summary.js'

export function parseIpcInput<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new Error(`${label}: ${result.error.message}`)
  }
  return result.data
}

/** Validates IPC handler return values before they cross the preload boundary. */
export function parseIpcOutput<T>(schema: z.ZodType<T>, output: unknown, label: string): T {
  return parseIpcInput(schema, output, label)
}
