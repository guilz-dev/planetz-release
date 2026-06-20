import {
  type AppState,
  type AutoWorkflowDecision,
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  type ExecutionAnalyticsWindow,
  type ExecutionLogTaskStatusFilter,
  type PromptHistoryItem,
  type TaskViewModel,
  type WorkflowMode,
} from '@planetz/shared'
import { create } from 'zustand'
import {
  MAX_RECENT_WORKFLOWS,
  parseStoredRecentWorkflowNames,
  pushRecentWorkflowNames,
} from '../lib/recent-workflows.js'
import type { ChatMode } from '../types/chat-mode.js'

export type ClosablePanelId = 'tasks' | 'composer'

export type PanelVisibility = Record<ClosablePanelId, boolean>

export type ActiveView =
  | 'task'
  | 'workflow'
  | 'log'
  | 'summary'
  | 'adapter'
  | 'issue'
  | 'decisions'
  | 'spec-studio'

export type LegacyActiveView = 'chat' | 'spec-desk'

/** Primary view id or legacy tab ids normalized on persist. */
export type ActiveViewInput = ActiveView | LegacyActiveView

const LEGACY_ACTIVE_VIEW_ALIASES: Record<LegacyActiveView, ActiveView> = {
  chat: 'spec-studio',
  'spec-desk': 'spec-studio',
}

export const ACTIVE_VIEW_STORAGE_KEY = 'planetz.ui.activeView.v1'

const ACTIVE_VIEW_VALUES = new Set<ActiveView>([
  'task',
  'workflow',
  'adapter',
  'log',
  'summary',
  'issue',
  'decisions',
  'spec-studio',
])

/** Normalizes persisted or legacy view ids to a supported primary view. */
export function normalizeActiveView(raw: string | null | undefined): ActiveView {
  if (!raw) return 'task'
  const aliased = LEGACY_ACTIVE_VIEW_ALIASES[raw as LegacyActiveView]
  if (aliased) return aliased
  if (ACTIVE_VIEW_VALUES.has(raw as ActiveView)) return raw as ActiveView
  return 'task'
}

/** Shared source-context payload for assist sessions (Composer panel or Chat). */
export interface AssistHandoffPayload {
  /** Pre-built, untrusted Source Context block, injected into the assist session. */
  sourceContext: string
  /** Workflow to preselect for the assist session. */
  workflow?: string
}

/**
 * One-shot handoff into Composer Assist (Issue/PR).
 * Consumed once by the Prompt Composer on mount, then cleared.
 */
export interface ComposerAssistHandoff extends AssistHandoffPayload {
  /** Origin issue ref (e.g. `owner/repo#123`), shown as a reference note. */
  issueRef?: string
}

/**
 * One-shot handoff into Conversation Mode (Issue tab or task detail).
 * Consumed by {@link useChatAssistHandoff} after form options are ready.
 */
export interface ChatAssistHandoff extends AssistHandoffPayload {
  /** Origin issue ref when handoff comes from the Issue tab. */
  issueRef?: string
  /** Task id when handoff comes from the task detail panel. */
  taskId?: string
  /** Open workspace path; used before composer form options finish loading. */
  workspacePath?: string
}

/**
 * One-shot handoff from Chat transcript into Add Task composer.
 * Consumed by PromptComposer once after navigation to Task view.
 */
export interface ChatToTaskHandoff {
  body: string
  sourceThreadId?: string
  sourceTurnId?: string
  truncated?: boolean
}

/** One-shot filters applied when navigating to the execution log view. */
export interface ExecutionLogPreset {
  keyword?: string
  runId?: string
  window?: ExecutionAnalyticsWindow
  taskStatus?: ExecutionLogTaskStatusFilter
  executorId?: string
}

export type ExecutorFilterView = 'task' | 'log'

export interface ExecutorFilterByView {
  task?: string
  log?: string
}

/** Reads persisted primary view; legacy chat/spec-desk migrate to spec-studio. */
export function readStoredActiveView(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): ActiveView {
  try {
    const resolvedStorage =
      storage ?? (typeof window !== 'undefined' ? (window as Window).localStorage : null)
    const raw = resolvedStorage?.getItem(ACTIVE_VIEW_STORAGE_KEY)
    const normalized = normalizeActiveView(raw)
    if (raw && raw !== normalized && resolvedStorage) {
      try {
        resolvedStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, normalized)
      } catch {
        // ignore storage failures
      }
    }
    return normalized
  } catch {
    return 'task'
  }
}

function readActiveView(): ActiveView {
  return readStoredActiveView()
}

function writeActiveView(value: ActiveView): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, value)
  } catch {
    // localStorage unavailable; ignore
  }
}

const PANEL_VISIBILITY_STORAGE_KEY = 'planetz.ui.panelVisibility.v4'

const DEFAULT_PANEL_VISIBILITY: PanelVisibility = {
  tasks: true,
  composer: true,
}

function readPanelVisibility(): PanelVisibility {
  if (typeof window === 'undefined') return DEFAULT_PANEL_VISIBILITY
  try {
    const raw = window.localStorage.getItem(PANEL_VISIBILITY_STORAGE_KEY)
    if (!raw) return DEFAULT_PANEL_VISIBILITY
    const parsed = JSON.parse(raw) as Partial<PanelVisibility>
    return {
      tasks: typeof parsed.tasks === 'boolean' ? parsed.tasks : true,
      composer: typeof parsed.composer === 'boolean' ? parsed.composer : true,
    }
  } catch {
    return DEFAULT_PANEL_VISIBILITY
  }
}

function writePanelVisibility(value: PanelVisibility): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PANEL_VISIBILITY_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // localStorage unavailable; ignore
  }
}

export const RECENT_WORKFLOWS_STORAGE_KEY = 'planetz.ui.recentWorkflows.v1'
export const WORKFLOW_MODE_STORAGE_KEY = 'planetz.ui.workflowMode.v1'
export const DECISIONS_EXPENSIVE_ONLY_STORAGE_KEY = 'planetz.ui.decisionsExpensiveOnly.v1'

function readDecisionsExpensiveOnly(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(DECISIONS_EXPENSIVE_ONLY_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function writeDecisionsExpensiveOnly(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DECISIONS_EXPENSIVE_ONLY_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // localStorage unavailable; ignore
  }
}

function readWorkflowMode(): WorkflowMode {
  if (typeof window === 'undefined') return 'auto'
  try {
    const raw = window.localStorage.getItem(WORKFLOW_MODE_STORAGE_KEY)
    return raw === 'manual' ? 'manual' : 'auto'
  } catch {
    return 'auto'
  }
}

function writeWorkflowMode(value: WorkflowMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WORKFLOW_MODE_STORAGE_KEY, value)
  } catch {
    // localStorage unavailable; ignore
  }
}

export const CHAT_MODE_STORAGE_KEY = 'planetz.ui.chatMode.v2'
const CHAT_MODE_STORAGE_KEY_V1 = 'planetz.ui.chatMode.v1'
export const CHAT_SIDEBAR_STORAGE_KEY = 'planetz.ui.chatSidebar.v1'

function readChatMode(): ChatMode {
  if (typeof window === 'undefined') return 'interactive'
  try {
    const raw =
      window.localStorage.getItem(CHAT_MODE_STORAGE_KEY) ??
      window.localStorage.getItem(CHAT_MODE_STORAGE_KEY_V1)
    if (raw === 'spec' || raw === 'agent' || raw === 'interactive') return raw
    return 'interactive'
  } catch {
    return 'interactive'
  }
}

function writeChatMode(value: ChatMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, value)
  } catch {
    // localStorage unavailable; ignore
  }
}

function readChatSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

function writeChatSidebarCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, value ? 'collapsed' : 'expanded')
  } catch {
    // localStorage unavailable; ignore
  }
}

function readRecentWorkflows(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_WORKFLOWS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return parseStoredRecentWorkflowNames(parsed)
  } catch {
    return []
  }
}

function writeRecentWorkflows(value: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECENT_WORKFLOWS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // localStorage unavailable; ignore
  }
}

function resolveTaskExecutorFilterId(task: TaskViewModel): string {
  return task.executorAttribution?.executorId ?? task.assignedAgentId ?? 'all'
}

function navigateToExecutionLog(preset: ExecutionLogPreset): {
  activeView: 'log'
  executionLogPreset: ExecutionLogPreset
} {
  writeActiveView('log')
  return { activeView: 'log', executionLogPreset: preset }
}

const SELECTION_GUARD_MS = 750

interface AppStore {
  state: AppState | null
  /** Ignore stale main-process selection until this timestamp (ms). */
  selectionGuardUntil: number
  /** Bumped on each `setState` so analytics views can refetch when tasks/runs change. */
  stateRevision: number
  workspaceSwitching: boolean
  promptHistory: PromptHistoryItem[]
  themeId: string
  counterPackEnabled: boolean
  uiLanguage: 'en' | 'ja'
  composerAssistDefaultMode: 'direct' | 'assist'
  workflowLowConfidenceGateEnabled: boolean
  selectedWorkflow: string
  workflowMode: WorkflowMode
  lastAutoDecision: AutoWorkflowDecision | null
  /** Recently selected workflow names for Add Task combobox (newest first). */
  recentWorkflowNames: string[]
  activeView: ActiveView
  chatMode: ChatMode
  chatSidebarCollapsed: boolean
  composerAssistHandoff: ComposerAssistHandoff | null
  chatAssistHandoff: ChatAssistHandoff | null
  chatToTaskHandoff: ChatToTaskHandoff | null
  /** Set when queued handoff fails to start a chat thread (cleared on success or new queue). */
  chatHandoffError: string | null
  executionLogPreset: ExecutionLogPreset | null
  /** Shared filter for Decisions queue list and rail badge. */
  decisionsExpensiveOnly: boolean
  /** When set, Decisions view lists pending entries for this task only. */
  decisionsFilterTaskId: string | null
  executorFilterByView: ExecutorFilterByView
  panelVisibility: PanelVisibility
  setState: (state: AppState) => void
  setSelectedTaskId: (selectedTaskId: string | undefined) => void
  setWorkspaceSwitching: (switching: boolean) => void
  setPromptHistory: (items: PromptHistoryItem[]) => void
  setUiPreferences: (prefs: {
    themeId: string
    counterPackEnabled: boolean
    uiLanguage: 'en' | 'ja'
    composerAssistDefaultMode?: 'direct' | 'assist'
    workflowLowConfidenceGateEnabled?: boolean
  }) => void
  setSelectedWorkflow: (name: string) => void
  setWorkflowMode: (mode: WorkflowMode) => void
  setLastAutoDecision: (decision: AutoWorkflowDecision | null) => void
  /** User picked a workflow in Add Task; updates selection and recent list. */
  selectWorkflowForComposer: (name: string) => void
  pushRecentWorkflow: (name: string) => void
  setActiveView: (view: ActiveViewInput) => void
  setChatMode: (mode: ChatMode) => void
  setChatSidebarCollapsed: (collapsed: boolean) => void
  setComposerAssistHandoff: (handoff: ComposerAssistHandoff | null) => void
  setChatAssistHandoff: (handoff: ChatAssistHandoff | null) => void
  setChatToTaskHandoff: (handoff: ChatToTaskHandoff | null) => void
  setChatHandoffError: (message: string | null) => void
  openExecutionLogForTask: (task: TaskViewModel) => void
  openExecutionLogForFailure: (task: TaskViewModel) => void
  clearExecutionLogPreset: () => void
  setDecisionsExpensiveOnly: (expensiveOnly: boolean) => void
  openDecisionsForTask: (taskId: string) => void
  clearDecisionsFilter: () => void
  setExecutorFilter: (view: ExecutorFilterView, executorId: string | undefined) => void
  setPanelVisible: (panel: ClosablePanelId, visible: boolean) => void
  resetPanelVisibility: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  state: null,
  selectionGuardUntil: 0,
  stateRevision: 0,
  workspaceSwitching: false,
  promptHistory: [],
  themeId: 'default',
  counterPackEnabled: false,
  uiLanguage: 'en',
  composerAssistDefaultMode: 'direct',
  workflowLowConfidenceGateEnabled: false,
  selectedWorkflow: COMPOSER_DEFAULT_WORKFLOW_NAME,
  workflowMode: readWorkflowMode(),
  lastAutoDecision: null,
  recentWorkflowNames: readRecentWorkflows(),
  activeView: readActiveView(),
  chatMode: readChatMode(),
  chatSidebarCollapsed: readChatSidebarCollapsed(),
  composerAssistHandoff: null,
  chatAssistHandoff: null,
  chatToTaskHandoff: null,
  chatHandoffError: null,
  executionLogPreset: null,
  decisionsExpensiveOnly: readDecisionsExpensiveOnly(),
  decisionsFilterTaskId: null,
  executorFilterByView: {},
  panelVisibility: readPanelVisibility(),
  setState: (state) =>
    set((s) => {
      const guardActive = Date.now() < s.selectionGuardUntil
      const selectedTaskId =
        guardActive && s.state?.selectedTaskId !== undefined
          ? s.state.selectedTaskId
          : state.selectedTaskId
      return {
        state: { ...state, selectedTaskId },
        selectionGuardUntil: guardActive ? s.selectionGuardUntil : 0,
        stateRevision: s.stateRevision + 1,
      }
    }),
  setSelectedTaskId: (selectedTaskId) =>
    set((s) =>
      s.state
        ? {
            selectionGuardUntil: Date.now() + SELECTION_GUARD_MS,
            state: { ...s.state, selectedTaskId },
          }
        : {},
    ),
  setWorkspaceSwitching: (workspaceSwitching) => set({ workspaceSwitching }),
  setPromptHistory: (promptHistory) => set({ promptHistory }),
  setUiPreferences: ({
    themeId,
    counterPackEnabled,
    uiLanguage,
    composerAssistDefaultMode,
    workflowLowConfidenceGateEnabled,
  }) =>
    set((state) => ({
      themeId,
      counterPackEnabled,
      uiLanguage,
      composerAssistDefaultMode: composerAssistDefaultMode ?? state.composerAssistDefaultMode,
      workflowLowConfidenceGateEnabled:
        workflowLowConfidenceGateEnabled ?? state.workflowLowConfidenceGateEnabled,
    })),
  setSelectedWorkflow: (selectedWorkflow) => set({ selectedWorkflow }),
  setWorkflowMode: (workflowMode) =>
    set(() => {
      writeWorkflowMode(workflowMode)
      return { workflowMode }
    }),
  setLastAutoDecision: (lastAutoDecision) => set({ lastAutoDecision }),
  selectWorkflowForComposer: (name) =>
    set((s) => {
      const recentWorkflowNames = pushRecentWorkflowNames(
        s.recentWorkflowNames,
        name,
        MAX_RECENT_WORKFLOWS,
      )
      writeRecentWorkflows(recentWorkflowNames)
      return { selectedWorkflow: name, recentWorkflowNames }
    }),
  pushRecentWorkflow: (name) =>
    set((s) => {
      const recentWorkflowNames = pushRecentWorkflowNames(
        s.recentWorkflowNames,
        name,
        MAX_RECENT_WORKFLOWS,
      )
      writeRecentWorkflows(recentWorkflowNames)
      return { recentWorkflowNames }
    }),
  setActiveView: (view) =>
    set(() => {
      const normalized = normalizeActiveView(view)
      writeActiveView(normalized)
      return { activeView: normalized, decisionsFilterTaskId: null }
    }),
  setChatMode: (chatMode) =>
    set(() => {
      writeChatMode(chatMode)
      return { chatMode }
    }),
  setChatSidebarCollapsed: (chatSidebarCollapsed) =>
    set(() => {
      writeChatSidebarCollapsed(chatSidebarCollapsed)
      return { chatSidebarCollapsed }
    }),
  setComposerAssistHandoff: (composerAssistHandoff) => set({ composerAssistHandoff }),
  setChatAssistHandoff: (chatAssistHandoff) => set({ chatAssistHandoff }),
  setChatToTaskHandoff: (chatToTaskHandoff) => set({ chatToTaskHandoff }),
  setChatHandoffError: (chatHandoffError) => set({ chatHandoffError }),
  openExecutionLogForTask: (task) =>
    set(() =>
      navigateToExecutionLog({
        keyword: task.id,
        taskStatus: 'all',
        executorId: resolveTaskExecutorFilterId(task),
      }),
    ),
  openExecutionLogForFailure: (task) =>
    set(() => {
      const failureRunId = task.failure?.runId
      return navigateToExecutionLog({
        ...(failureRunId ? { runId: failureRunId } : { keyword: task.id }),
        window: 'all',
        taskStatus: task.status,
        executorId: resolveTaskExecutorFilterId(task),
      })
    }),
  clearExecutionLogPreset: () => set({ executionLogPreset: null }),
  setDecisionsExpensiveOnly: (expensiveOnly) => {
    writeDecisionsExpensiveOnly(expensiveOnly)
    set({ decisionsExpensiveOnly: expensiveOnly })
  },
  openDecisionsForTask: (taskId) =>
    set(() => {
      writeActiveView('decisions')
      return { activeView: 'decisions', decisionsFilterTaskId: taskId }
    }),
  clearDecisionsFilter: () => set({ decisionsFilterTaskId: null }),
  setExecutorFilter: (view, executorId) =>
    set((s) => ({
      executorFilterByView: {
        ...s.executorFilterByView,
        [view]: executorId,
      },
    })),
  setPanelVisible: (panel, visible) =>
    set((s) => {
      const next = { ...s.panelVisibility, [panel]: visible }
      writePanelVisibility(next)
      return { panelVisibility: next }
    }),
  resetPanelVisibility: () =>
    set(() => {
      writePanelVisibility(DEFAULT_PANEL_VISIBILITY)
      return { panelVisibility: { ...DEFAULT_PANEL_VISIBILITY } }
    }),
}))
