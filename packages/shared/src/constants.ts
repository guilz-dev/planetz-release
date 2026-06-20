/** Skin-specific terms that must not appear in shared/main/preload paths (see §3). */
export const SKIN_BANNED_TERMS = [
  'shari',
  'neta',
  'sushi',
  'enqueueNeta',
  'reassignNeta',
  'takt-sushi-planet',
  'SushiCounter',
] as const

export const PROMPT_HISTORY_MAX_ITEMS = 100

export const MODEL_HISTORY_FILENAME = 'model-history.json'

export const MODEL_HISTORY_MAX_ITEMS = 100

export const EFFORT_HISTORY_FILENAME = 'effort-history.json'

export const EFFORT_HISTORY_MAX_ITEMS = 100

/** TTL for in-memory cache of live provider model discovery (ms). */
export const LIVE_PROVIDER_MODELS_TTL_MS = 10 * 60 * 1000

/** Timeout for a single live provider model fetch (CLI exec or SDK session). */
export const LIVE_PROVIDER_MODEL_FETCH_TIMEOUT_MS = 30_000

/** @deprecated Use {@link LIVE_PROVIDER_MODELS_TTL_MS}. */
export const CURSOR_LIVE_MODELS_TTL_MS = LIVE_PROVIDER_MODELS_TTL_MS

/** Parent directory for Planetz-managed workspace artifacts. */
export const PLANETZ_SIDECAR_PARENT_DIR_NAME = '.planetz'

/** @deprecated Typo parent dir; read-only fallback when resolving workspace sidecar root. */
export const LEGACY_PLANETS_TYPO_SIDECAR_PARENT_DIR_NAME = '.planets'

/** Planetz canonical sidecar directory name under `PLANETZ_SIDECAR_PARENT_DIR_NAME`. */
export const PLANETZ_SIDECAR_DIR_BASENAME = 'orbit'

/** Planetz canonical sidecar root under each workspace. */
export const SIDECAR_DIR_NAME =
  `${PLANETZ_SIDECAR_PARENT_DIR_NAME}/${PLANETZ_SIDECAR_DIR_BASENAME}` as const

/** SQLite database filename for Planetz sidecar persistence. */
export const PLANETZ_SQLITE_FILENAME = 'planetz.db'

/** One-shot `~/.takt` import payload under main sidecar root (SSOT for home import). */
export const ORBIT_IMPORT_SNAPSHOT_DIRNAME = 'import-snapshot'

export const HOME_TAKT_IMPORT_MARKER_FILENAME = '.home-takt-imported'

/** v0.1 mock queue file under the Planetz sidecar dir (not `tasks.yaml`). */
export const MOCK_QUEUE_FILENAME = 'mock-queue.json'

export const CONVERSATIONS_FILENAME = 'conversations.json'
export const RETRY_CONTEXTS_FILENAME = 'retry-contexts.json'
export const CHAINS_FILENAME = 'chains.json'
export const WATCH_STATE_FILENAME = 'watch-state.json'

/** Broadcast throttle for log-heavy state updates (§19). */
export const STATE_BROADCAST_THROTTLE_MS = 300

/** Max user turns in Composer Assist before finalize is forced. */
/** Max characters for Composer Assist Issue/PR source context (IPC and sidecar snapshot). */
export const COMPOSER_ASSIST_SOURCE_CONTEXT_MAX_CHARS = 65_536

export const COMPOSER_ASSISTANT_MAX_TURNS = 8

/** LLM call timeout for Composer Assist (ms). */
export const COMPOSER_ASSISTANT_TIMEOUT_MS = 60_000

/** LLM call timeout for workflow auto-routing during enqueue (ms). */
export const WORKFLOW_ROUTING_LLM_TIMEOUT_MS = 12_000

/** LLM call timeout for task title generation during enqueue (ms). */
export const TASK_TITLE_LLM_TIMEOUT_MS = 12_000

/** Max depth when expanding workflow_call for structure feature extraction. */
export const WORKFLOW_FEATURE_MAX_CALL_DEPTH = 4

/** Max depth when walking completion paths in workflow feature extraction. */
export const WORKFLOW_COMPLETION_PATH_MAX_DEPTH = 40

/** Edit-step ratio at or above which changeMode is edit_heavy. */
export const WORKFLOW_FEATURE_EDIT_HEAVY_RATIO = 0.6

/** Top workflow candidates passed to the final structure-match LLM. */
export const WORKFLOW_AUTO_FINAL_CANDIDATES = 5

/** Minimum top-gap required to skip final compare and keep deterministic rank-1. */
export const WORKFLOW_AUTO_FINAL_SHORT_CIRCUIT_SCORE_GAP = 0.2

/** Score gap at or below which complexity rerank may prefer a lighter workflow (simple tasks). */
export const WORKFLOW_ROUTING_COMPLEXITY_SCORE_TIE_THRESHOLD = 0.12

/** Step-count ratio at or above which a lighter workflow may win over a close-scoring peer. */
export const WORKFLOW_ROUTING_COMPLEXITY_STEP_RATIO_THRESHOLD = 2

/**
 * Budget for connector I/O, sidecar persist, and state refresh after title resolution (ms).
 * Paired with routing/title LLM timeouts for {@link ENQUEUE_IPC_TIMEOUT_MS}.
 */
export const ENQUEUE_MAIN_PIPELINE_BUDGET_MS = 78_000

/** Renderer IPC timeout for enqueue and assist finalize (ms). */
export const ENQUEUE_IPC_TIMEOUT_MS =
  WORKFLOW_ROUTING_LLM_TIMEOUT_MS + TASK_TITLE_LLM_TIMEOUT_MS + ENQUEUE_MAIN_PIPELINE_BUDGET_MS

/** SQLite kv_store key for the active Composer Assist draft session. */
export const COMPOSER_ASSIST_SESSION_KV_KEY = 'composer_assist_session'

/** SQLite kv_store key for unsent Chat View composer drafts (per workspace sidecar). */
export const CHAT_COMPOSER_DRAFT_KV_KEY = 'chat_composer_draft'

/** SQLite kv_store key for Composer Assist failure/success counters. */
export const COMPOSER_ASSIST_METRICS_KV_KEY = 'composer_assist_metrics'

/** SQLite kv_store key for Chat → Add Task handoff usage counters. */
export const CHAT_TO_TASK_METRICS_KV_KEY = 'chat_to_task_metrics'

/** Default Add Task input mode when opening the composer. */
export const COMPOSER_ASSIST_DEFAULT_MODES = ['direct', 'assist'] as const
export type ComposerAssistDefaultMode = (typeof COMPOSER_ASSIST_DEFAULT_MODES)[number]

/** Initial workflow in Add Task / PromptComposer (single-step generic). */
export const COMPOSER_DEFAULT_WORKFLOW_NAME = 'minimal'

/** Multi-step workflow seeded on workspace open (plan → implement → review). */
export const PRODUCT_DEFAULT_WORKFLOW_NAME = 'default'

/** Investigation-first conversation workflow used by Chat mode. */
export const CHAT_INVESTIGATION_WORKFLOW_NAME = 'chat-investigation'

/** Spec-driven development workflow (BA → architect → UX → planner → coder/ui-coder). */
export const SPEC_DRIVEN_WORKFLOW_NAME = 'spec-driven'

/** Max characters copied from Chat into Add Task one-shot handoff. */
export const CHAT_TO_TASK_HANDOFF_MAX_CHARS = 16_000

/** Color themes (tokens only). Manta animation is toggled separately via `counterPackEnabled`. */
export const AVAILABLE_THEME_IDS = [
  'default',
  'operations',
  'andromeda',
  'nebula',
  'supernova',
] as const
export type AvailableThemeId = (typeof AVAILABLE_THEME_IDS)[number]

/**
 * @deprecated Pre theme/skin split. Use {@link AVAILABLE_THEME_IDS} + `counterPackEnabled`.
 * Kept so legacy `ui.skin` values still parse during migration.
 */
export const AVAILABLE_SKIN_IDS = AVAILABLE_THEME_IDS
export type AvailableSkinId = AvailableThemeId

/** Legacy persisted `ui.skin` value for the manta mode (constants.ts is exempt from check:skin). */
export const LEGACY_COUNTER_PACK_SKIN_ID = 'sushi' as const

/** Legacy persisted `ui.theme` value; migrated to `default` + `counterPackEnabled`. */
export const LEGACY_SUSHI_COUNTER_THEME_ID = 'sushi-counter' as const

/** Max workflow names stored in composer recent list and IPC `recentWorkflowNames`. */
export const MAX_RECENT_WORKFLOWS = 5

const DEFAULT_TAKT_DIR = '.takt' as const

export const DEFAULT_CONFIG = {
  taktDir: DEFAULT_TAKT_DIR,
  taktConfigPath: `${DEFAULT_TAKT_DIR}/config.yaml`,
  workflowsDir: `${DEFAULT_TAKT_DIR}/workflows`,
  facetsDir: `${DEFAULT_TAKT_DIR}/facets`,
  tasksYamlPath: `${DEFAULT_TAKT_DIR}/tasks.yaml`,
  tasksDir: `${DEFAULT_TAKT_DIR}/tasks`,
  runsDir: `${DEFAULT_TAKT_DIR}/runs`,
  watch: { autoStart: true },
  ui: {
    theme: 'default' as const,
    counterPackEnabled: false,
    language: 'en' as const,
    laneSpeed: 'normal' as const,
    composerAssistDefaultMode: 'direct' as const,
    workflowLowConfidenceGateEnabled: false,
    workflowLibrary: {
      enabledPacks: [] as string[],
      enabledWorkflows: [] as string[],
      autoEnabledWorkflows: [] as string[],
      implicitEnabledWorkflows: [] as string[],
      dismissedImplicitWorkflows: [] as string[],
    },
    pinnedWorkflows: [] as string[],
    hiddenCoreWorkflows: [] as string[],
    ollama: { toolsGuard: 'block' as const },
  },
} as const
