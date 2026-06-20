import {
  CHAT_INVESTIGATION_WORKFLOW_NAME,
  COMPOSER_DEFAULT_WORKFLOW_NAME,
  isComposerSessionNotFoundError,
  isHeadlessInteractiveUnavailableError,
  type PlanetzSessionPolicy,
  sessionPolicyFromChatMode,
} from '@planetz/shared'
import type {
  ChatGateway,
  ChatSelectOption,
  ChatThreadLoadResult,
  ChatThreadSummary,
  ChatTurn,
} from '../components/chat/chat-types'
import { fetchChatFormOptions } from '../lib/fetch-chat-form-options.js'

function mapThreadSummary(thread: {
  threadId: string
  title: string
  workspacePath: string
  workspaceLabel: string
  updatedAt: string
  hasActiveSession: boolean
  activeSessionId?: string
  sessionPolicy?: PlanetzSessionPolicy
}): ChatThreadSummary {
  return {
    id: thread.threadId,
    title: thread.title,
    workspacePath: thread.workspacePath,
    workspaceLabel: thread.workspaceLabel,
    updatedAt: thread.updatedAt,
    hasActiveSession: thread.hasActiveSession,
    ...(thread.activeSessionId ? { activeSessionId: thread.activeSessionId } : {}),
    ...(thread.sessionPolicy ? { sessionPolicy: thread.sessionPolicy } : {}),
  }
}

function mapTurn(turn: {
  turnId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}): ChatTurn {
  return {
    id: turn.turnId,
    role: turn.role,
    content: turn.content,
    createdAt: turn.createdAt,
  }
}

function workspaceLabelFromPath(workspacePath: string): string {
  const parts = workspacePath.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? workspacePath
}

function workflowNameForChatMode(mode: 'interactive' | 'spec' | 'agent'): string {
  return mode === 'spec' ? COMPOSER_DEFAULT_WORKFLOW_NAME : CHAT_INVESTIGATION_WORKFLOW_NAME
}

type LoadedConversationThread =
  | { found: false }
  | {
      found: true
      activeSessionId: string | null
      sessionPolicy?: PlanetzSessionPolicy
      turns: ChatTurn[]
    }

async function resolveSessionPolicyAfterResume(input: {
  ledgerPolicy?: PlanetzSessionPolicy
  activeSessionId: string | null
}): Promise<PlanetzSessionPolicy | undefined> {
  if (input.ledgerPolicy) return input.ledgerPolicy
  if (!input.activeSessionId) return undefined
  try {
    const active = await window.orbit.getActiveComposerSession()
    return active?.sessionPolicy
  } catch {
    return undefined
  }
}

async function resumeComposerSessionIfPresent(activeSessionId: string): Promise<void> {
  try {
    await window.orbit.resumeComposerSession({ sessionId: activeSessionId })
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[planetz] resumeComposerSession failed for ${activeSessionId}; history still loads. ${message}`,
      )
    }
  }
}

async function loadConversationThread(threadId: string): Promise<LoadedConversationThread> {
  const result = await window.orbit.getConversationHistory({ threadId })
  if (!result.found) return { found: false }
  const activeSessionId = result.thread.activeSessionId ?? null
  if (result.thread.hasActiveSession && activeSessionId) {
    await resumeComposerSessionIfPresent(activeSessionId)
  }
  const sessionPolicy = await resolveSessionPolicyAfterResume({
    ledgerPolicy: result.thread.sessionPolicy,
    activeSessionId: result.thread.hasActiveSession ? activeSessionId : null,
  })
  return {
    found: true,
    activeSessionId,
    sessionPolicy,
    turns: result.turns.map(mapTurn),
  }
}

function requireActiveSessionId(threadId: string, activeSessionId: string | null): string {
  if (!activeSessionId) {
    throw new Error(`Thread has no active session: ${threadId}`)
  }
  return activeSessionId
}

export function createOrbitChatGateway(): ChatGateway {
  return {
    async listThreads(input) {
      const result = await window.orbit.listConversationHistory(
        input?.workspacePath ? { workspacePath: input.workspacePath } : undefined,
      )
      return result.threads.map(mapThreadSummary)
    },

    async searchThreads(input) {
      const result = await window.orbit.searchConversationHistory({
        query: input.query,
        ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
      })
      return result.threads.map(mapThreadSummary)
    },

    async getThread(threadId): Promise<ChatThreadLoadResult> {
      const loaded = await loadConversationThread(threadId)
      if (!loaded.found) return { turns: [] }
      return {
        turns: loaded.turns,
        ...(loaded.sessionPolicy ? { sessionPolicy: loaded.sessionPolicy } : {}),
      }
    },

    async getActiveComposerSessionId(threadId) {
      const loaded = await loadConversationThread(threadId)
      if (!loaded.found) {
        throw new Error(`Conversation thread not found: ${threadId}`)
      }
      return requireActiveSessionId(threadId, loaded.activeSessionId)
    },

    async restartThreadSession(input) {
      const workflow = workflowNameForChatMode(input.mode)
      const sessionPolicy = sessionPolicyFromChatMode(input.mode)
      const turn = await window.orbit.startComposerSession({
        mode: 'interactive-assistant',
        workflow,
        forceNew: true,
        sessionPolicy,
        conversationLedger: {
          workspacePath: input.workspacePath,
          ...(input.branch?.trim() ? { branch: input.branch.trim() } : {}),
          existingThreadId: input.threadId,
        },
        ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
        ...(input.model?.trim() ? { model: input.model.trim() } : {}),
        ...(input.effort?.trim() ? { effort: input.effort.trim() } : {}),
      })
      return { composerSessionId: turn.sessionId }
    },

    async startThread(input) {
      const workflow = workflowNameForChatMode(input.mode)
      const sessionPolicy = sessionPolicyFromChatMode(input.mode)
      const startPayload = {
        mode: 'interactive-assistant' as const,
        workflow,
        forceNew: true,
        sessionPolicy,
        conversationLedger: {
          workspacePath: input.workspacePath,
          ...(input.branch?.trim() ? { branch: input.branch.trim() } : {}),
        },
        ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
        ...(input.model?.trim() ? { model: input.model.trim() } : {}),
        ...(input.effort?.trim() ? { effort: input.effort.trim() } : {}),
        ...(input.sourceContext?.trim() ? { sourceContext: input.sourceContext.trim() } : {}),
        ...(input.seedBody?.trim() ? { seedBody: input.seedBody.trim() } : {}),
      }
      try {
        const turn = await window.orbit.startComposerSession(startPayload)
        return { threadId: turn.sessionId }
      } catch (error: unknown) {
        if (isHeadlessInteractiveUnavailableError(error)) {
          throw new Error(
            'Headless interactive assistant is not available. Check orbit configuration and retry.',
          )
        }
        throw error
      }
    },

    async sendMessage(input) {
      let sessionId = input.composerSessionId?.trim()
      if (!sessionId) {
        const loaded = await loadConversationThread(input.threadId)
        if (!loaded.found) {
          throw new Error(`Conversation thread not found: ${input.threadId}`)
        }
        sessionId = requireActiveSessionId(input.threadId, loaded.activeSessionId)
      }

      let turn: Awaited<ReturnType<typeof window.orbit.messageComposerSession>>
      try {
        turn = await window.orbit.messageComposerSession({ sessionId, message: input.message })
      } catch (error: unknown) {
        if (!isComposerSessionNotFoundError(error)) {
          throw error
        }

        const loaded = await loadConversationThread(input.threadId)
        if (!loaded.found) {
          throw error
        }

        const recoveredSessionId = loaded.activeSessionId?.trim()
        if (!recoveredSessionId || recoveredSessionId === sessionId) {
          throw error
        }
        turn = await window.orbit.messageComposerSession({
          sessionId: recoveredSessionId,
          message: input.message,
        })
      }

      return {
        ...(turn.compactionSummary ? { compactionSummary: turn.compactionSummary } : {}),
      }
    },

    async finalizeThread(input) {
      const loaded = await loadConversationThread(input.threadId)
      if (!loaded.found) {
        throw new Error(`Conversation thread not found: ${input.threadId}`)
      }
      const sessionId = requireActiveSessionId(input.threadId, loaded.activeSessionId)
      const result = await window.orbit.finalizeComposerSession({ sessionId })
      return {
        body: result.body,
        allowedActions: result.allowedActions,
      }
    },

    async cancelSend(input) {
      const loaded = await loadConversationThread(input.threadId)
      if (!loaded.found || !loaded.activeSessionId) return
      await window.orbit.interruptComposerSession({ sessionId: loaded.activeSessionId })
    },

    async loadComposerDraft() {
      const result = await window.orbit.getChatComposerDraft()
      return result.snapshot
    },

    async saveComposerDraft(snapshot) {
      await window.orbit.saveChatComposerDraft(snapshot)
    },

    async getFormOptions() {
      const [workspace, formOptions] = await Promise.all([
        window.orbit.getWorkspace(),
        fetchChatFormOptions(),
      ])
      const workspaces: ChatSelectOption[] = workspace.path
        ? [
            {
              value: workspace.path,
              label: workspaceLabelFromPath(workspace.path),
            },
          ]
        : []
      const {
        branches,
        providers,
        models,
        modelsByProvider,
        lastSelectedModelByProvider,
        efforts,
        effortsByProvider,
        defaultBranch,
        defaultProvider,
        defaultModel,
        defaultEffort,
      } = formOptions
      return {
        workspaces,
        branches,
        providers,
        models,
        modelsByProvider,
        lastSelectedModelByProvider,
        efforts,
        effortsByProvider,
        defaultBranch,
        defaultProvider,
        defaultModel,
        defaultEffort,
      }
    },
  }
}
