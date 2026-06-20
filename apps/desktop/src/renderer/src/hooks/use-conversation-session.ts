import {
  appendClaudeCliFailureGuidance,
  type ComposerAssistActiveSession,
  type ComposerAssistantTurn,
  type ComposerSessionMode,
  composerAssistDraftMatchesInput,
  isComposerContextTooLargeError,
  isComposerSessionNotFoundError,
  isHeadlessInteractiveUnavailableError,
  type PlanetzSessionPolicy,
} from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComposerSummaryPreviewData } from '../components/composer-summary-preview'
import { useI18n } from '../i18n'
import type { ChatStreamState } from '../lib/chat-stream-state'
import {
  type AssistTurn,
  applyAssistStartTurnUi,
  type ConversationLine,
  mapAssistTurnsForPanel,
} from '../lib/conversation-assist-panel-ui'
import { isConversationSessionTimeoutError } from '../lib/conversation-session-errors'

export type { AssistTurn, ConversationLine } from '../lib/conversation-assist-panel-ui'

export type ConversationSessionRetryableAction =
  | 'start'
  | 'send'
  | 'finalize'
  | 'accept'
  | 'play'
  | null
export type ConversationSessionBusyAction = 'init' | 'send' | 'finalize' | 'accept' | 'play' | null

export type ConversationSessionInput = {
  seedBody?: string
  workflow: string
  provider?: string
  model?: string
  effort?: string
  sourceContext?: string
  forceNew?: boolean
  sessionPolicy?: PlanetzSessionPolicy
}

export type UseConversationSessionOptions = ConversationSessionInput & {
  disabled?: boolean
  autoStart?: boolean
  onFinalize: (body: string) => void | Promise<void>
  onRunNow?: (body: string) => void | Promise<void>
}

export function useConversationSession(options: UseConversationSessionOptions) {
  const { t } = useI18n()
  const {
    seedBody = '',
    workflow,
    provider,
    model,
    effort,
    sourceContext,
    forceNew,
    sessionPolicy,
    disabled = false,
    autoStart = true,
    onFinalize,
    onRunNow,
  } = options

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<AssistTurn[]>([])
  const [conversation, setConversation] = useState<ConversationLine[]>([])
  const [summaryPreview, setSummaryPreview] = useState<ComposerSummaryPreviewData | null>(null)
  const [reply, setReply] = useState('')
  const [readyToFinalize, setReadyToFinalize] = useState(false)
  const [busyAction, setBusyAction] = useState<ConversationSessionBusyAction>(null)
  const busy = busyAction !== null
  const [resumedDraft, setResumedDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryableAction, setRetryableAction] = useState<ConversationSessionRetryableAction>(null)
  const [backendMode, setBackendMode] = useState<ComposerSessionMode | null>(null)
  const [compactionNotice, setCompactionNotice] = useState<string | null>(null)

  const startedRef = useRef(false)
  const sendGenerationRef = useRef(0)
  const tRef = useRef(t)
  const sessionIdRef = useRef<string | null>(null)
  const pendingRetryMessageRef = useRef<string | null>(null)
  const startInputRef = useRef({
    seedBody,
    workflow,
    provider,
    model,
    effort,
    sourceContext,
    forceNew,
    sessionPolicy,
  })

  useEffect(() => {
    startInputRef.current = {
      seedBody,
      workflow,
      provider,
      model,
      effort,
      sourceContext,
      forceNew,
      sessionPolicy,
    }
  }, [seedBody, workflow, provider, model, effort, sourceContext, forceNew, sessionPolicy])

  useEffect(() => {
    tRef.current = t
  }, [t])

  const withLocalizedClaudeCliGuidance = useCallback((message: string): string => {
    return appendClaudeCliFailureGuidance(message, {
      title: tRef.current('composer.assistClaudeCliGuidanceTitle'),
      checks: [
        tRef.current('composer.assistClaudeCliGuidanceCheckVersion'),
        tRef.current('composer.assistClaudeCliGuidanceCheckAuth'),
        tRef.current('composer.assistClaudeCliGuidanceCheckFallback'),
      ],
    })
  }, [])

  const beginSession = useCallback(
    async (beginOptions?: { forceNew?: boolean }) => {
      sessionIdRef.current = null
      setSessionId(null)
      setTurns([])
      setConversation([])
      setSummaryPreview(null)
      setReadyToFinalize(false)
      setResumedDraft(false)
      setBackendMode(null)
      setBusyAction('init')
      setError(null)
      setRetryableAction(null)
      const startInput = startInputRef.current
      const startPayload = {
        seedBody: startInput.seedBody?.trim() || undefined,
        workflow: startInput.workflow.trim() || undefined,
        ...(startInput.provider?.trim() ? { provider: startInput.provider.trim() } : {}),
        ...(startInput.model?.trim() ? { model: startInput.model.trim() } : {}),
        ...(startInput.sourceContext?.trim()
          ? { sourceContext: startInput.sourceContext.trim() }
          : {}),
        ...(beginOptions?.forceNew || startInput.forceNew ? { forceNew: true } : {}),
        ...(startInput.sessionPolicy ? { sessionPolicy: startInput.sessionPolicy } : {}),
      }
      try {
        const capabilities = await window.orbit.getComposerAssistCapabilities()
        let mode: ComposerSessionMode = capabilities.startMode
        let turn: ComposerAssistantTurn
        try {
          turn = await window.orbit.startComposerSession({ mode, ...startPayload })
        } catch (headlessError: unknown) {
          if (
            mode === 'interactive-assistant' &&
            isHeadlessInteractiveUnavailableError(headlessError)
          ) {
            mode = 'planning-only'
            turn = await window.orbit.startComposerSession({ mode, ...startPayload })
          } else {
            throw headlessError
          }
        }
        setBackendMode(mode)
        sessionIdRef.current = turn.sessionId
        setSessionId(turn.sessionId)
        applyAssistStartTurnUi(turn, startInput.seedBody ?? '', {
          setConversation,
          setTurns,
          setReadyToFinalize,
        })
      } catch (startError: unknown) {
        sessionIdRef.current = null
        const message =
          startError instanceof Error ? startError.message : 'Failed to start assist session'
        setError(
          isConversationSessionTimeoutError(startError)
            ? tRef.current('composer.assistTimeout')
            : withLocalizedClaudeCliGuidance(message),
        )
        setRetryableAction('start')
      } finally {
        setBusyAction(null)
      }
    },
    [withLocalizedClaudeCliGuidance],
  )

  const restoreSession = useCallback((active: ComposerAssistActiveSession) => {
    sessionIdRef.current = active.sessionId
    setSessionId(active.sessionId)
    setBackendMode(active.mode ?? null)
    if (active.conversation && active.conversation.length > 0) {
      setConversation(
        active.conversation.map((line, index) => ({
          id: `${active.sessionId}-c${index}`,
          role: line.role,
          content: line.content,
        })),
      )
      setTurns([])
    } else {
      setTurns(mapAssistTurnsForPanel(active.sessionId, active.turns))
      setConversation([])
    }
    setSummaryPreview(null)
    setReadyToFinalize(active.readyToFinalize)
    setResumedDraft(true)
  }, [])

  const initializeSession = useCallback(async () => {
    setBusyAction('init')
    setError(null)
    setRetryableAction(null)
    try {
      const startInput = startInputRef.current
      if (startInput.sourceContext?.trim()) {
        await beginSession({ forceNew: true })
        return
      }
      const active = await window.orbit.getActiveComposerSession()
      if (
        active &&
        (active.turns.length > 0 || (active.conversation?.length ?? 0) > 0) &&
        composerAssistDraftMatchesInput(
          {
            seedBody: startInput.seedBody?.trim() || undefined,
            workflow: startInput.workflow.trim() || undefined,
            ...(startInput.provider?.trim() ? { provider: startInput.provider.trim() } : {}),
            ...(startInput.model?.trim() ? { model: startInput.model.trim() } : {}),
            effort: startInput.effort?.trim() || undefined,
            ...(startInput.sessionPolicy ? { sessionPolicy: startInput.sessionPolicy } : {}),
          },
          {
            seedBody: active.seedBody,
            workflow: active.workflow,
            provider: active.provider,
            model: active.model,
            effort: active.effort,
            ...(active.sessionPolicy ? { sessionPolicy: active.sessionPolicy } : {}),
          },
        )
      ) {
        const resumed = await window.orbit.resumeComposerSession({ sessionId: active.sessionId })
        restoreSession(resumed)
        return
      }
      await beginSession()
    } catch (initError: unknown) {
      sessionIdRef.current = null
      const message =
        initError instanceof Error ? initError.message : 'Failed to restore assist session'
      setError(
        isConversationSessionTimeoutError(initError)
          ? tRef.current('composer.assistTimeout')
          : withLocalizedClaudeCliGuidance(message),
      )
      setRetryableAction('start')
    } finally {
      setBusyAction(null)
    }
  }, [beginSession, restoreSession, withLocalizedClaudeCliGuidance])

  const recoverExpiredSession = useCallback(
    async (lostSessionId: string): Promise<boolean> => {
      try {
        const resumed = await window.orbit.resumeComposerSession({ sessionId: lostSessionId })
        restoreSession(resumed)
        return true
      } catch {
        startedRef.current = false
        await initializeSession()
        return sessionIdRef.current !== null
      }
    },
    [initializeSession, restoreSession],
  )

  useEffect(() => {
    if (!autoStart || disabled || startedRef.current) return
    startedRef.current = true
    void initializeSession()
    return () => {
      startedRef.current = false
    }
  }, [autoStart, disabled, initializeSession])

  const cancelSession = useCallback(async () => {
    const activeSessionId = sessionIdRef.current
    if (!activeSessionId) return
    await window.orbit.cancelComposerSession({ sessionId: activeSessionId }).catch(() => {})
    sessionIdRef.current = null
    setSessionId(null)
  }, [])

  const applyTurn = useCallback((turn: ComposerAssistantTurn) => {
    setReadyToFinalize(turn.readyToFinalize)
    setTurns((current) => [
      ...current,
      {
        id: `${turn.sessionId}-${current.length + 1}`,
        question: turn.question,
        recommendedAnswer: turn.recommendedAnswer,
      },
    ])
  }, [])

  const sendReply = useCallback(
    async (message: string, sendOptions?: { allowSessionRecovery?: boolean }) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || !message.trim() || busyAction !== null) return
      const generation = ++sendGenerationRef.current
      setBusyAction('send')
      setError(null)
      setRetryableAction(null)
      setCompactionNotice(null)
      const trimmed = message.trim()
      pendingRetryMessageRef.current = trimmed
      setReply('')
      const appendUserToConversation = conversation.length > 0
      if (appendUserToConversation) {
        setConversation((current) => [
          ...current,
          { id: `${activeSessionId}-u-${current.length}`, role: 'user', content: trimmed },
        ])
      }
      try {
        const turn = await window.orbit.messageComposerSession({
          sessionId: activeSessionId,
          message: trimmed,
        })
        if (sendGenerationRef.current !== generation) return
        pendingRetryMessageRef.current = null
        if (turn.compactionSummary) {
          setCompactionNotice(turn.compactionSummary.message)
        }
        const assistantContent = turn.assistantMessage?.trim()
        if (assistantContent) {
          setConversation((current) => {
            const next = [...current]
            const last = next[next.length - 1]
            if (!last || last.role !== 'user' || last.content !== trimmed) {
              next.push({
                id: `${activeSessionId}-u-${next.length}`,
                role: 'user',
                content: trimmed,
              })
            }
            next.push({
              id: `${activeSessionId}-a-${next.length}`,
              role: 'assistant',
              content: assistantContent,
            })
            return next
          })
          setReadyToFinalize(turn.readyToFinalize)
        } else {
          setTurns((current) => {
            const next = [...current]
            const last = next[next.length - 1]
            if (last) next[next.length - 1] = { ...last, userReply: trimmed }
            return next
          })
          applyTurn(turn)
        }
      } catch (sendError: unknown) {
        if (sendGenerationRef.current !== generation) return
        if (appendUserToConversation) {
          setConversation((current) => current.slice(0, -1))
        }
        if (
          sendOptions?.allowSessionRecovery !== false &&
          isComposerSessionNotFoundError(sendError)
        ) {
          const recovered = await recoverExpiredSession(activeSessionId)
          if (recovered && sessionIdRef.current) {
            await sendReply(trimmed, { allowSessionRecovery: false })
            return
          }
          setReply(trimmed)
          setError(t('composer.assistSessionExpired'))
          setRetryableAction('send')
          return
        }
        setReply(trimmed)
        if (isComposerContextTooLargeError(sendError)) {
          setError(sendError.message)
          setRetryableAction('send')
          return
        }
        const messageText =
          sendError instanceof Error ? sendError.message : 'Failed to send assist reply'
        setError(
          isConversationSessionTimeoutError(sendError)
            ? t('composer.assistTimeout')
            : withLocalizedClaudeCliGuidance(messageText),
        )
        setRetryableAction('send')
      } finally {
        if (sendGenerationRef.current === generation) setBusyAction(null)
      }
    },
    [
      applyTurn,
      busyAction,
      conversation.length,
      recoverExpiredSession,
      t,
      withLocalizedClaudeCliGuidance,
    ],
  )

  const finalize = useCallback(
    async (finalizeOptions?: { allowSessionRecovery?: boolean }) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || busyAction !== null) return
      setBusyAction('finalize')
      setError(null)
      setRetryableAction(null)
      try {
        const result = await window.orbit.finalizeComposerSession({ sessionId: activeSessionId })
        sessionIdRef.current = null
        setSessionId(null)
        if (result.allowedActions && result.allowedActions.length > 0) {
          setSummaryPreview({ body: result.body, allowedActions: result.allowedActions })
          return
        }
        await onFinalize(result.body)
      } catch (finalizeError: unknown) {
        if (
          finalizeOptions?.allowSessionRecovery !== false &&
          isComposerSessionNotFoundError(finalizeError)
        ) {
          const recovered = await recoverExpiredSession(activeSessionId)
          if (recovered && sessionIdRef.current) {
            await finalize({ allowSessionRecovery: false })
            return
          }
          setError(t('composer.assistSessionExpired'))
          setRetryableAction('finalize')
          return
        }
        const messageText =
          finalizeError instanceof Error
            ? finalizeError.message
            : 'Failed to finalize assist session'
        setError(
          isConversationSessionTimeoutError(finalizeError)
            ? t('composer.assistTimeout')
            : withLocalizedClaudeCliGuidance(messageText),
        )
        setRetryableAction('finalize')
      } finally {
        setBusyAction(null)
      }
    },
    [busyAction, onFinalize, recoverExpiredSession, t, withLocalizedClaudeCliGuidance],
  )

  const accept = useCallback(
    async (acceptOptions?: { allowSessionRecovery?: boolean }) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || busyAction !== null) return
      setBusyAction('accept')
      setError(null)
      setRetryableAction(null)
      try {
        const result = await window.orbit.acceptComposerSession({ sessionId: activeSessionId })
        sessionIdRef.current = null
        setSessionId(null)
        if (result.allowedActions && result.allowedActions.length > 0) {
          setSummaryPreview({ body: result.body, allowedActions: result.allowedActions })
          return
        }
        await onFinalize(result.body)
      } catch (acceptError: unknown) {
        if (
          acceptOptions?.allowSessionRecovery !== false &&
          isComposerSessionNotFoundError(acceptError)
        ) {
          const recovered = await recoverExpiredSession(activeSessionId)
          if (recovered && sessionIdRef.current) {
            await accept({ allowSessionRecovery: false })
            return
          }
          setError(t('composer.assistSessionExpired'))
          setRetryableAction('accept')
          return
        }
        const messageText =
          acceptError instanceof Error ? acceptError.message : 'Failed to accept assist reply'
        setError(
          isConversationSessionTimeoutError(acceptError)
            ? t('composer.assistTimeout')
            : withLocalizedClaudeCliGuidance(messageText),
        )
        setRetryableAction('accept')
      } finally {
        setBusyAction(null)
      }
    },
    [busyAction, onFinalize, recoverExpiredSession, t, withLocalizedClaudeCliGuidance],
  )

  const play = useCallback(
    async (task: string, playOptions?: { allowSessionRecovery?: boolean }) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || busyAction !== null) return
      const trimmedTask = task.trim()
      if (!trimmedTask) {
        setError(t('composer.assistPlayEmpty'))
        setRetryableAction(null)
        return
      }
      setBusyAction('play')
      setError(null)
      setRetryableAction(null)
      pendingRetryMessageRef.current = trimmedTask
      try {
        const result = await window.orbit.playComposerSession({
          sessionId: activeSessionId,
          task: trimmedTask,
        })
        pendingRetryMessageRef.current = null
        sessionIdRef.current = null
        setSessionId(null)
        setReply('')
        if (result.allowedActions && result.allowedActions.length > 0) {
          setSummaryPreview({ body: result.body, allowedActions: result.allowedActions })
          return
        }
        await onFinalize(result.body)
      } catch (playError: unknown) {
        if (
          playOptions?.allowSessionRecovery !== false &&
          isComposerSessionNotFoundError(playError)
        ) {
          const recovered = await recoverExpiredSession(activeSessionId)
          if (recovered && sessionIdRef.current) {
            await play(trimmedTask, { allowSessionRecovery: false })
            return
          }
          setError(t('composer.assistSessionExpired'))
          setRetryableAction('play')
          return
        }
        const messageText =
          playError instanceof Error ? playError.message : 'Failed to run assist instruction'
        setError(
          isConversationSessionTimeoutError(playError)
            ? t('composer.assistTimeout')
            : withLocalizedClaudeCliGuidance(messageText),
        )
        setRetryableAction('play')
      } finally {
        setBusyAction(null)
      }
    },
    [busyAction, onFinalize, recoverExpiredSession, t, withLocalizedClaudeCliGuidance],
  )

  const retry = useCallback(() => {
    if (retryableAction === 'start') {
      void beginSession()
      return
    }
    if (retryableAction === 'send' && pendingRetryMessageRef.current) {
      void sendReply(pendingRetryMessageRef.current)
      return
    }
    if (retryableAction === 'finalize') {
      void finalize()
      return
    }
    if (retryableAction === 'accept') {
      void accept()
      return
    }
    if (retryableAction === 'play') {
      void play(reply)
    }
  }, [accept, beginSession, finalize, play, reply, retryableAction, sendReply])

  const dismissSummaryPreview = useCallback(() => {
    setSummaryPreview(null)
  }, [])

  const cancelSend = useCallback(() => {
    if (busyAction !== 'send') return
    sendGenerationRef.current += 1
    setBusyAction(null)
  }, [busyAction])

  const streamState = useMemo((): ChatStreamState => {
    if (busyAction === 'send' || busyAction === 'init') return 'streaming'
    if (error && retryableAction) return 'error'
    return 'idle'
  }, [busyAction, error, retryableAction])

  const useConversationUi = backendMode === 'interactive-assistant' && conversation.length > 0
  const hasAssistantReply = conversation.some((line) => line.role === 'assistant')
  const canUseAcceptPlay = backendMode === 'interactive-assistant' && hasAssistantReply
  const initialLoading =
    busyAction === 'init' && turns.length === 0 && conversation.length === 0 && !error

  return {
    sessionId,
    turns,
    conversation,
    summaryPreview,
    reply,
    setReply,
    readyToFinalize,
    busyAction,
    busy,
    resumedDraft,
    error,
    retryableAction,
    streamState,
    compactionNotice,
    cancelSend,
    backendMode,
    useConversationUi,
    canUseAcceptPlay,
    initialLoading,
    beginSession,
    initializeSession,
    recoverExpiredSession,
    cancelSession,
    sendReply,
    finalize,
    accept,
    play,
    retry,
    dismissSummaryPreview,
    onRunNow,
  }
}
