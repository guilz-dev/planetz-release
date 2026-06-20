import {
  CHAT_COMPOSER_DRAFT_HISTORY_LIMIT,
  chatSessionPolicyToChatMode,
  isComposerContextTooLargeError,
  isComposerSessionNotFoundError,
} from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSendIntent } from '../components/chat/chat-composer-form'
import type { ChatGateway, ChatThreadSummary, ChatTurn } from '../components/chat/chat-types'
import type { ComposerSummaryPreviewData } from '../components/composer-summary-preview'
import { CHAT_HANDOFF_NOT_READY, type ChatHandoffStartResult } from '../lib/chat-assist-handoff.js'
import { buildChatDraftHistorySummary } from '../lib/chat-composer-draft-mapper.js'
import { chatSendErrorMessage } from '../lib/chat-send-error-message.js'
import { supportsLiveComposerStream } from '../lib/chat-stream-provider-support'
import {
  CHAT_CANCEL_SETTLE_MS,
  type ChatStreamState,
  isChatStreamBusy,
  isChatStreamCancellable,
} from '../lib/chat-stream-state'
import { buildInFlightPresentation } from '../lib/in-flight-chat-status'
import type { ChatAssistHandoff } from '../store/app-store'
import type { ChatMode } from '../types/chat-mode'
import { useChatComposerDraftPersistence } from './use-chat-composer-draft-persistence.js'
import { useComposerStreamSubscription } from './use-composer-stream-subscription.js'

const DRAFT_HISTORY_PREFIX = 'draft_'

export type UseChatThreadSendOptions = {
  gateway: ChatGateway
  chatMode: ChatMode
  /** Open workspace path; used to reload persisted drafts after workspace switch. */
  currentWorkspacePath?: string
  /** Canonical list threads plus any sidebar-only rows (e.g. remote search hits). */
  threadSummariesForLookup: ChatThreadSummary[]
  refreshThreads: () => Promise<void>
  draft: string
  setDraft: (value: string) => void
  setSpecPreview: (value: ComposerSummaryPreviewData | null) => void
  workspaceValue: string
  branchValue: string
  providerValue: string
  setProviderValue: (value: string) => void
  modelValue: string
  setModelValue: (value: string) => void
  effortValue: string
  canStartThread: boolean
  setWorkspaceValue: (value: string) => void
  setChatMode: (mode: ChatMode) => void
}

export function useChatThreadSend({
  gateway,
  chatMode,
  currentWorkspacePath,
  threadSummariesForLookup,
  refreshThreads,
  draft,
  setDraft,
  setSpecPreview,
  workspaceValue,
  branchValue,
  providerValue,
  setProviderValue,
  modelValue,
  setModelValue,
  effortValue,
  canStartThread,
  setWorkspaceValue,
  setChatMode,
}: UseChatThreadSendOptions) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [streamState, setStreamState] = useState<ChatStreamState>('idle')
  const [streamError, setStreamError] = useState<string | null>(null)
  const [compactionNotice, setCompactionNotice] = useState<string | null>(null)

  const draftPersistenceKey = (currentWorkspacePath ?? workspaceValue).trim()
  const { draftHistory, setDraftHistory, activeDraftId, setActiveDraftId } =
    useChatComposerDraftPersistence({
      gateway,
      persistenceKey: draftPersistenceKey,
      draft,
      setDraft,
      providerValue,
      setProviderValue,
      modelValue,
      setModelValue,
    })

  const threadRequestRef = useRef(0)
  const activeThreadIdRef = useRef<string | null>(null)
  const sendGenerationRef = useRef(0)
  const lastFailedMessageRef = useRef<string | null>(null)
  const sessionConfigDirtyRef = useRef(false)
  const cancelSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { streamingTurn, clearStreamingTurn, beginStreamForSend } =
    useComposerStreamSubscription(sendGenerationRef)

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  useEffect(() => {
    return () => {
      if (cancelSettleTimerRef.current !== null) {
        clearTimeout(cancelSettleTimerRef.current)
      }
    }
  }, [])

  const clearCancelSettleTimer = useCallback(() => {
    if (cancelSettleTimerRef.current !== null) {
      clearTimeout(cancelSettleTimerRef.current)
      cancelSettleTimerRef.current = null
    }
  }, [])

  const loadThread = useCallback(
    async (threadId: string) => {
      const requestId = ++threadRequestRef.current
      setThreadLoading(true)
      setSpecPreview(null)
      try {
        const loaded = await gateway.getThread(threadId)
        if (threadRequestRef.current !== requestId) return
        setTurns(Array.isArray(loaded.turns) ? loaded.turns : [])
        if (loaded.sessionPolicy) {
          setChatMode(chatSessionPolicyToChatMode(loaded.sessionPolicy))
        }
      } finally {
        if (threadRequestRef.current === requestId) setThreadLoading(false)
      }
    },
    [gateway, setChatMode, setSpecPreview],
  )

  const ensureThreadId = useCallback(
    async (
      existingThreadId: string | null,
      options?: { initialMessage?: string; refreshList?: boolean },
    ): Promise<string | null> => {
      if (existingThreadId) return existingThreadId
      if (!canStartThread) return null

      const started = await gateway.startThread({
        workspacePath: workspaceValue,
        branch: branchValue,
        provider: providerValue,
        model: modelValue,
        effort: effortValue,
        mode: chatMode,
      })
      activeThreadIdRef.current = started.threadId
      setActiveThreadId(started.threadId)

      const initialMessage = options?.initialMessage?.trim()
      if (initialMessage) {
        await gateway.sendMessage({ threadId: started.threadId, message: initialMessage })
      }
      if (options?.refreshList) {
        await refreshThreads()
      }
      return started.threadId
    },
    [
      canStartThread,
      gateway,
      workspaceValue,
      branchValue,
      providerValue,
      modelValue,
      effortValue,
      chatMode,
      refreshThreads,
    ],
  )

  const handleSelectThread = useCallback(
    (threadId: string) => {
      const draftItem = draftHistory.find((entry) => entry.summary.id === threadId)
      if (draftItem) {
        sendGenerationRef.current += 1
        threadRequestRef.current += 1
        clearCancelSettleTimer()
        setActiveDraftId(draftItem.summary.id)
        activeThreadIdRef.current = null
        setActiveThreadId(null)
        setTurns([])
        setThreadLoading(false)
        setStreamState('idle')
        setStreamError(null)
        setCompactionNotice(null)
        clearStreamingTurn()
        setSpecPreview(null)
        setDraft(draftItem.body)
        sessionConfigDirtyRef.current = false
        return
      }
      if (threadId === activeThreadId) return
      const selectedThread = threadSummariesForLookup.find((thread) => thread.id === threadId)
      if (selectedThread?.sessionPolicy) {
        setChatMode(chatSessionPolicyToChatMode(selectedThread.sessionPolicy))
      }
      sendGenerationRef.current += 1
      threadRequestRef.current += 1
      clearCancelSettleTimer()
      setActiveDraftId(null)
      activeThreadIdRef.current = threadId
      setActiveThreadId(threadId)
      setTurns([])
      setDraft('')
      setThreadLoading(true)
      setStreamState('idle')
      setStreamError(null)
      setCompactionNotice(null)
      clearStreamingTurn()
      sessionConfigDirtyRef.current = false
      void loadThread(threadId)
    },
    [
      activeThreadId,
      draftHistory,
      loadThread,
      setDraft,
      clearStreamingTurn,
      setActiveDraftId,
      setSpecPreview,
      setChatMode,
      threadSummariesForLookup,
      clearCancelSettleTimer,
    ],
  )

  const changeChatMode = useCallback(
    async (nextMode: ChatMode) => {
      if (nextMode === chatMode) return
      const threadId = activeThreadIdRef.current
      const summary = threadId
        ? threadSummariesForLookup.find((thread) => thread.id === threadId)
        : undefined
      const restartThreadSession = gateway.restartThreadSession
      const shouldRebind =
        !!threadId &&
        !!restartThreadSession &&
        ((summary?.hasActiveSession ?? false) || (turns?.length ?? 0) > 0)

      if (!shouldRebind) {
        setChatMode(nextMode)
        return
      }

      const boundThreadId = threadId
      await restartThreadSession({
        threadId: boundThreadId,
        mode: nextMode,
        workspacePath: workspaceValue,
        branch: branchValue,
        provider: providerValue,
        model: modelValue,
        effort: effortValue,
      })
      sessionConfigDirtyRef.current = false
      setChatMode(nextMode)
      void refreshThreads()
      await loadThread(boundThreadId)
    },
    [
      chatMode,
      gateway,
      threadSummariesForLookup,
      turns,
      workspaceValue,
      branchValue,
      providerValue,
      modelValue,
      effortValue,
      setChatMode,
      refreshThreads,
      loadThread,
    ],
  )

  const handleNewChat = useCallback(() => {
    const unsentDraft = draft.trim()
    if (unsentDraft.length > 0) {
      const now = new Date().toISOString()
      const workspacePath = workspaceValue.trim()
      const draftId =
        activeDraftId ??
        `${DRAFT_HISTORY_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const summary = buildChatDraftHistorySummary({
        id: draftId,
        body: unsentDraft,
        workspacePath,
        updatedAt: now,
      })
      setDraftHistory((current) => {
        const withoutSameId = current.filter((entry) => entry.summary.id !== draftId)
        return [{ summary, body: unsentDraft }, ...withoutSameId].slice(
          0,
          CHAT_COMPOSER_DRAFT_HISTORY_LIMIT,
        )
      })
    }
    sendGenerationRef.current += 1
    threadRequestRef.current += 1
    clearCancelSettleTimer()
    setActiveDraftId(null)
    activeThreadIdRef.current = null
    setActiveThreadId(null)
    setTurns([])
    setDraft('')
    setSpecPreview(null)
    setThreadLoading(false)
    setStreamState('idle')
    setStreamError(null)
    setCompactionNotice(null)
    clearStreamingTurn()
    lastFailedMessageRef.current = null
    sessionConfigDirtyRef.current = false
  }, [
    activeDraftId,
    clearStreamingTurn,
    draft,
    setDraft,
    setDraftHistory,
    setActiveDraftId,
    setSpecPreview,
    workspaceValue,
    clearCancelSettleTimer,
  ])

  const startThreadFromHandoff = useCallback(
    async (handoff: ChatAssistHandoff): Promise<ChatHandoffStartResult> => {
      const workspacePath = handoff.workspacePath?.trim() || workspaceValue.trim()
      if (!workspacePath || !branchValue.trim() || !modelValue.trim()) {
        return { ok: false, message: CHAT_HANDOFF_NOT_READY }
      }
      sendGenerationRef.current += 1
      threadRequestRef.current += 1
      clearCancelSettleTimer()
      setStreamState('idle')
      setStreamError(null)
      setCompactionNotice(null)
      clearStreamingTurn()
      setSpecPreview(null)
      setDraft('')
      setThreadLoading(true)
      sessionConfigDirtyRef.current = false
      try {
        const started = await gateway.startThread({
          workspacePath,
          branch: branchValue,
          provider: providerValue,
          model: modelValue,
          effort: effortValue,
          mode: 'interactive',
          sourceContext: handoff.sourceContext,
        })
        if (handoff.workspacePath?.trim() && handoff.workspacePath.trim() !== workspaceValue) {
          setWorkspaceValue(handoff.workspacePath.trim())
        }
        activeThreadIdRef.current = started.threadId
        setActiveThreadId(started.threadId)
        setTurns([])
        await refreshThreads()
        return { ok: true }
      } catch (error: unknown) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Failed to start conversation',
        }
      } finally {
        setThreadLoading(false)
      }
    },
    [
      gateway,
      workspaceValue,
      branchValue,
      providerValue,
      modelValue,
      effortValue,
      refreshThreads,
      setDraft,
      setSpecPreview,
      setWorkspaceValue,
      clearStreamingTurn,
      clearCancelSettleTimer,
    ],
  )

  const recoverMissingComposerSession = useCallback(
    async (message: string, generation: number): Promise<boolean> => {
      try {
        const restarted = await gateway.startThread({
          workspacePath: workspaceValue,
          branch: branchValue,
          provider: providerValue,
          model: modelValue,
          effort: effortValue,
          mode: chatMode,
        })

        if (sendGenerationRef.current !== generation) return true

        activeThreadIdRef.current = restarted.threadId
        setActiveThreadId(restarted.threadId)

        let composerSessionId = restarted.threadId
        let allowSessionRebind = false
        try {
          composerSessionId = await gateway.getActiveComposerSessionId(restarted.threadId)
        } catch {
          allowSessionRebind = true
        }

        beginStreamForSend(generation, composerSessionId, {
          seedThinkingPlaceholder: !supportsLiveComposerStream(providerValue),
          allowSessionRebind,
        })

        const result = await gateway.sendMessage({
          threadId: restarted.threadId,
          message,
          composerSessionId,
        })
        if (sendGenerationRef.current !== generation) return true

        if (result.compactionSummary?.message) {
          setCompactionNotice(result.compactionSummary.message)
        }
        const refreshed = await gateway.getThread(restarted.threadId)
        if (activeThreadIdRef.current === restarted.threadId) {
          setTurns(refreshed.turns)
        }
        lastFailedMessageRef.current = null
        clearStreamingTurn()
        setStreamState('idle')
        setStreamError(null)
        void refreshThreads()
        return true
      } catch {
        return false
      }
    },
    [
      gateway,
      workspaceValue,
      branchValue,
      providerValue,
      modelValue,
      effortValue,
      chatMode,
      beginStreamForSend,
      clearStreamingTurn,
      refreshThreads,
    ],
  )

  const runUserMessageSend = useCallback(
    async (message: string, existingThreadId: string | null, options?: { isRetry?: boolean }) => {
      const generation = ++sendGenerationRef.current
      clearCancelSettleTimer()
      setStreamError(null)
      setStreamState(options?.isRetry ? 'retrying' : 'streaming')
      clearStreamingTurn()
      lastFailedMessageRef.current = message
      const trimmedMessage = message.trim()
      let pendingDraftId: string | null = null
      if (!existingThreadId && trimmedMessage.length > 0) {
        const now = new Date().toISOString()
        const workspacePath = workspaceValue.trim()
        const draftId =
          activeDraftId ??
          `${DRAFT_HISTORY_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const summary = buildChatDraftHistorySummary({
          id: draftId,
          body: trimmedMessage,
          workspacePath,
          updatedAt: now,
        })
        setDraftHistory((current) => {
          const withoutSameId = current.filter((entry) => entry.summary.id !== draftId)
          return [{ summary, body: trimmedMessage }, ...withoutSameId].slice(
            0,
            CHAT_COMPOSER_DRAFT_HISTORY_LIMIT,
          )
        })
        setActiveDraftId(draftId)
        pendingDraftId = draftId
      }
      const optimisticId = `optimistic_${Date.now()}`
      const optimistic: ChatTurn = {
        id: optimisticId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      }
      setTurns((current) => {
        const withoutPending = current.filter((turn) => !turn.id.startsWith('optimistic_'))
        return [...withoutPending, optimistic]
      })

      let threadId: string | null
      try {
        threadId = await ensureThreadId(existingThreadId, { refreshList: true })
      } catch (error: unknown) {
        if (sendGenerationRef.current !== generation) return
        setStreamState('error')
        if (isComposerContextTooLargeError(error)) {
          setStreamError(error.message)
        } else {
          setStreamError(chatSendErrorMessage(error))
        }
        return
      }
      if (!threadId) {
        setStreamState('idle')
        clearStreamingTurn()
        setTurns((current) => current.filter((turn) => turn.id !== optimisticId))
        return
      }
      if (existingThreadId && threadId === existingThreadId && sessionConfigDirtyRef.current) {
        if (gateway.restartThreadSession) {
          try {
            await gateway.restartThreadSession({
              threadId,
              mode: chatMode,
              workspacePath: workspaceValue,
              branch: branchValue,
              provider: providerValue,
              model: modelValue,
              effort: effortValue,
            })
            sessionConfigDirtyRef.current = false
            await refreshThreads()
          } catch (error: unknown) {
            if (sendGenerationRef.current !== generation) return
            clearStreamingTurn()
            setStreamState('error')
            setTurns((current) => current.filter((turn) => turn.id !== optimisticId))
            if (isComposerContextTooLargeError(error)) {
              setStreamError(error.message)
            } else {
              setStreamError(chatSendErrorMessage(error))
            }
            return
          }
        }
      }
      let composerSessionId = threadId
      let allowSessionRebind = false
      try {
        composerSessionId = await gateway.getActiveComposerSessionId(threadId)
      } catch {
        // Fall back to thread id and allow first stream line to rebind session id.
        allowSessionRebind = true
      }
      beginStreamForSend(generation, composerSessionId, {
        seedThinkingPlaceholder: !supportsLiveComposerStream(providerValue),
        allowSessionRebind,
      })
      if (pendingDraftId) {
        setDraftHistory((current) => current.filter((entry) => entry.summary.id !== pendingDraftId))
        setActiveDraftId(null)
      }
      try {
        const result = await gateway.sendMessage({
          threadId,
          message,
          composerSessionId,
        })
        if (sendGenerationRef.current !== generation) return
        if (result.compactionSummary?.message) {
          setCompactionNotice(result.compactionSummary.message)
        }
        const refreshed = await gateway.getThread(threadId)
        if (activeThreadIdRef.current === threadId) {
          setTurns(refreshed.turns)
        }
        lastFailedMessageRef.current = null
        clearStreamingTurn()
        setStreamState('idle')
        void refreshThreads()
      } catch (error: unknown) {
        if (sendGenerationRef.current !== generation) return
        if (isComposerSessionNotFoundError(error)) {
          const recovered = await recoverMissingComposerSession(message, generation)
          if (recovered) return
        }
        clearStreamingTurn()
        setStreamState('error')
        if (isComposerContextTooLargeError(error)) {
          setStreamError(error.message)
        } else {
          setStreamError(chatSendErrorMessage(error))
        }
      }
    },
    [
      activeDraftId,
      ensureThreadId,
      gateway,
      refreshThreads,
      providerValue,
      modelValue,
      effortValue,
      chatMode,
      branchValue,
      setDraftHistory,
      setActiveDraftId,
      workspaceValue,
      clearStreamingTurn,
      beginStreamForSend,
      recoverMissingComposerSession,
      clearCancelSettleTimer,
    ],
  )

  const handleSend = useCallback(
    async (intent: ChatSendIntent) => {
      const message = draft.trim()
      if (intent === 'finalize') {
        const threadId = await ensureThreadId(activeThreadId, {
          initialMessage: message || undefined,
        })
        if (!threadId) return

        const result = await gateway.finalizeThread({ threadId })
        setSpecPreview({
          body: result.body,
          allowedActions: result.allowedActions ?? ['save_task', 'continue'],
        })
        setDraft('')
        await refreshThreads()
        const refreshed = await gateway.getThread(threadId)
        if (activeThreadIdRef.current === threadId) {
          setTurns(refreshed.turns)
        }
        setActiveDraftId(null)
        return
      }

      if (!message || isChatStreamBusy(streamState)) return
      if (activeThreadId) {
        const selected = threadSummariesForLookup.find((thread) => thread.id === activeThreadId)
        if (selected && !selected.hasActiveSession) return
      }

      setActiveDraftId(null)
      setDraft('')
      await runUserMessageSend(message, activeThreadId)
    },
    [
      draft,
      streamState,
      activeThreadId,
      threadSummariesForLookup,
      gateway,
      ensureThreadId,
      refreshThreads,
      runUserMessageSend,
      setActiveDraftId,
      setDraft,
      setSpecPreview,
    ],
  )

  const cancelSend = useCallback(() => {
    if (streamState !== 'streaming' && streamState !== 'retrying') return
    const threadId = activeThreadIdRef.current
    sendGenerationRef.current += 1
    setStreamState('cancelling')
    setStreamError(null)
    clearStreamingTurn()
    setTurns((current) => current.filter((turn) => !turn.id.startsWith('optimistic_')))
    if (threadId && gateway.cancelSend) {
      void gateway.cancelSend({ threadId }).catch(() => {})
    }
    clearCancelSettleTimer()
    cancelSettleTimerRef.current = setTimeout(() => {
      cancelSettleTimerRef.current = null
      setStreamState((current) => (current === 'cancelling' ? 'idle' : current))
    }, CHAT_CANCEL_SETTLE_MS)
  }, [streamState, gateway, clearStreamingTurn, clearCancelSettleTimer])

  const retrySend = useCallback(() => {
    const message = lastFailedMessageRef.current?.trim()
    if (!message || isChatStreamBusy(streamState)) return
    void runUserMessageSend(message, activeThreadId, { isRetry: true })
  }, [streamState, activeThreadId, runUserMessageSend])

  const activeThread =
    threadSummariesForLookup.find((thread) => thread.id === activeThreadId) ?? null
  const threadReadOnly = activeThread !== null && !activeThread.hasActiveSession
  const sending = isChatStreamBusy(streamState)
  const canSubmit = !threadReadOnly && !sending && (activeThreadId !== null || canStartThread)
  const inFlightAssistant = buildInFlightPresentation(streamState, streamingTurn)
  const canCancelSend = isChatStreamCancellable(streamState)

  const markSessionConfigDirty = useCallback(() => {
    if (activeThreadIdRef.current) {
      sessionConfigDirtyRef.current = true
    }
  }, [])

  return {
    activeThreadId,
    activeSidebarThreadId: activeThreadId ?? activeDraftId,
    turns,
    streamingTurn,
    threadLoading,
    sending,
    inFlightAssistant,
    canCancelSend,
    streamState,
    streamError,
    compactionNotice,
    draftHistoryThreads: draftHistory.map((item) => item.summary),
    cancelSend,
    retrySend,
    markSessionConfigDirty,
    startThreadFromHandoff,
    activeThread,
    threadReadOnly,
    canSubmit,
    handleSelectThread,
    changeChatMode,
    handleNewChat,
    handleSend,
  }
}
