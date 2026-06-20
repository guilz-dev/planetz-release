import {
  CHAT_TO_TASK_HANDOFF_MAX_CHARS,
  coerceChatModeForCapabilities,
  hasTaskBodyContent,
  normalizeTaskBodyForSubmit,
  type RecentWorkspace,
  resolveChatMcpDisabledReason,
} from '@planetz/shared'
import { PanelLeftOpen } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatAssistHandoff } from '../../hooks/use-chat-assist-handoff'
import { useChatGateway } from '../../hooks/use-chat-gateway'
import { useChatMcpConsent } from '../../hooks/use-chat-mcp-consent'
import { useChatSessionApply } from '../../hooks/use-chat-session-apply'
import { useChatThreadController } from '../../hooks/use-chat-thread-controller'
import { useConfirmDialog } from '../../hooks/use-confirm-dialog'
import { useDesktopCapabilities } from '../../hooks/use-desktop-capabilities'
import { useI18n } from '../../i18n'
import { recordChatToTaskMetric } from '../../lib/chat-to-task-metrics.js'
import { getChatComposerStreamBridgeGap } from '../../lib/orbit-bridge-guard'
import type { PromptComposerRunDraft } from '../../lib/prompt-composer-run-draft'
import { useAppStore } from '../../store/app-store'
import type { ChatMode } from '../../types/chat-mode'
import { BridgeCapabilityBanner } from '../bridge-capability-banner'
import { ComposerSummaryPreview } from '../composer-summary-preview'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { ChatApplyDiffDialog } from './chat-apply-diff-dialog'
import { ChatComposerForm } from './chat-composer-form'
import { ChatConversationPane } from './chat-conversation-pane'
import type { ChatEmptyCopyVariant } from './chat-empty-state'
import { ChatHistorySidebar } from './chat-history-sidebar'

interface ChatViewProps {
  /** Current workspace path, used to surface its threads first. */
  currentWorkspacePath?: string
  className?: string
  /** Enqueue finalized spec body (same path as Prompt Composer). */
  onEnqueueSpec?: (draft: PromptComposerRunDraft) => Promise<void>
  /** Run finalized spec immediately (same path as Prompt Composer). */
  onRunNowSpec?: (draft: PromptComposerRunDraft) => Promise<void>
  /** Optional provider allowlist (same semantics as Add Task). */
  allowedProviders?: ReadonlyArray<string>
  /** Workspace menu inputs (same behavior as header Workspace menu). */
  recentWorkspaces?: ReadonlyArray<RecentWorkspace>
  onChangeWorkspace?: () => void
  onOpenRecentWorkspace?: (path: string) => Promise<boolean>
  onRemoveRecentWorkspace?: (path: string) => Promise<void>
  /** Hide the built-in thread sidebar (host provides its own thread list, e.g. Spec Studio). */
  hideSidebar?: boolean
  /** Externally select a thread; when it changes the controller switches to it. */
  externalSelectedThreadId?: string | null
  /** Notifies the host of the controller's active thread id (after selection/send). */
  onActiveThreadChange?: (threadId: string | null) => void
  /** Notifies the host when a thread send settles to idle after streaming. */
  onThreadStreamSettled?: (input: {
    threadId: string | null
    latestAssistantTurnId: string | null
  }) => void
  /** Increment to request a new (empty) thread; ignored on initial mount. */
  newChatSignal?: number
  /** When set, overrides the global chat mode without writing to the store. */
  controlledMode?: ChatMode
  hideModeSwitcher?: boolean
  hideComposer?: boolean
  emptyCopyVariant?: ChatEmptyCopyVariant
}

/**
 * Container for Conversation Mode. Owns layout only; thread/session state lives in
 * `useChatThreadController` (data via `useChatGateway`).
 */
export function ChatView({
  currentWorkspacePath,
  className,
  onEnqueueSpec,
  onRunNowSpec,
  allowedProviders,
  recentWorkspaces = [],
  onChangeWorkspace,
  onOpenRecentWorkspace,
  onRemoveRecentWorkspace,
  hideSidebar = false,
  externalSelectedThreadId,
  onActiveThreadChange,
  onThreadStreamSettled,
  newChatSignal,
  controlledMode,
  hideModeSwitcher = false,
  hideComposer = false,
  emptyCopyVariant = 'clarify-first',
}: ChatViewProps) {
  const { t } = useI18n()
  const gateway = useChatGateway()
  const storeChatMode = useAppStore((s) => s.chatMode)
  const setChatMode = useAppStore((s) => s.setChatMode)
  const guardedSetChatMode = controlledMode ? () => {} : setChatMode
  const chatMode = controlledMode ?? storeChatMode
  const chatAssistHandoff = useAppStore((s) => s.chatAssistHandoff)
  const setChatAssistHandoff = useAppStore((s) => s.setChatAssistHandoff)
  const setChatHandoffError = useAppStore((s) => s.setChatHandoffError)
  const chatHandoffError = useAppStore((s) => s.chatHandoffError)
  const setChatToTaskHandoff = useAppStore((s) => s.setChatToTaskHandoff)
  const setPanelVisible = useAppStore((s) => s.setPanelVisible)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const setSelectedWorkflow = useAppStore((s) => s.setSelectedWorkflow)
  const selectedWorkflow = useAppStore((s) => s.selectedWorkflow)
  const workflowMode = useAppStore((s) => s.workflowMode)
  const sidebarCollapsed = useAppStore((s) => s.chatSidebarCollapsed)
  const setSidebarCollapsed = useAppStore((s) => s.setChatSidebarCollapsed)
  const [chatToTaskError, setChatToTaskError] = useState<string | null>(null)
  const [chatModeSwitchError, setChatModeSwitchError] = useState<string | null>(null)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [applyRefreshKey, setApplyRefreshKey] = useState(0)
  const [applySelectedPath, setApplySelectedPath] = useState<string | undefined>()
  const [applyFileContent, setApplyFileContent] = useState<
    import('@planetz/shared').TaskResultDiffFile | undefined
  >()
  const [applyFileLoading, setApplyFileLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const chatToTaskRetryTurnRef = useRef<{ id: string; content: string } | null>(null)
  const wasStreamBusyRef = useRef(false)
  const streamBusyContextRef = useRef<{
    threadId: string
    beforeAssistantTurnId: string | null
  } | null>(null)
  const desktopCapabilities = useDesktopCapabilities()

  const { requestConfirm, confirmDialog } = useConfirmDialog()
  const controller = useChatThreadController({
    gateway,
    chatMode,
    setChatMode: guardedSetChatMode,
    currentWorkspacePath,
    allowedProviders,
  })
  const chatStreamBridgeGap = useMemo(() => getChatComposerStreamBridgeGap(), [])

  useEffect(() => {
    if (controller.streamState === 'idle' && !controller.inFlightAssistant) {
      setApplyRefreshKey((key) => key + 1)
    }
  }, [controller.inFlightAssistant, controller.streamState])

  useEffect(() => {
    if (externalSelectedThreadId == null) return
    if (externalSelectedThreadId === controller.activeThreadId) return
    void controller.handleSelectThread(externalSelectedThreadId)
  }, [externalSelectedThreadId, controller.activeThreadId, controller.handleSelectThread])

  useEffect(() => {
    onActiveThreadChange?.(controller.activeThreadId)
  }, [controller.activeThreadId, onActiveThreadChange])

  const latestAssistantTurnId = useMemo(() => {
    for (let index = (controller.turns?.length ?? 0) - 1; index >= 0; index -= 1) {
      const turn = controller.turns?.[index]
      if (turn?.role === 'assistant') return turn.id
    }
    return null
  }, [controller.turns])

  useEffect(() => {
    const isBusy = controller.streamState !== 'idle' || controller.inFlightAssistant !== null
    if (isBusy) {
      if (!streamBusyContextRef.current && controller.activeThreadId) {
        streamBusyContextRef.current = {
          threadId: controller.activeThreadId,
          beforeAssistantTurnId: latestAssistantTurnId,
        }
      }
      wasStreamBusyRef.current = true
      return
    }
    if (!wasStreamBusyRef.current) return
    wasStreamBusyRef.current = false
    const context = streamBusyContextRef.current
    streamBusyContextRef.current = null
    if (!context) return
    void gateway
      .getThread(context.threadId)
      .then((thread) => {
        let afterAssistantTurnId: string | null = null
        for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
          const turn = thread.turns[index]
          if (turn.role === 'assistant') {
            afterAssistantTurnId = turn.id
            break
          }
        }
        if (afterAssistantTurnId && afterAssistantTurnId !== context.beforeAssistantTurnId) {
          onThreadStreamSettled?.({
            threadId: context.threadId,
            latestAssistantTurnId: afterAssistantTurnId,
          })
        }
      })
      .catch(() => {
        // best-effort
      })
  }, [
    controller.inFlightAssistant,
    controller.streamState,
    controller.activeThreadId,
    latestAssistantTurnId,
    gateway,
    onThreadStreamSettled,
  ])

  const newChatSignalRef = useRef(newChatSignal)
  useEffect(() => {
    if (newChatSignal === undefined) return
    if (newChatSignal === newChatSignalRef.current) return
    newChatSignalRef.current = newChatSignal
    controller.handleNewChat()
  }, [newChatSignal, controller.handleNewChat])

  const mcpDisabledReason = useMemo(
    () =>
      chatMode === 'agent'
        ? resolveChatMcpDisabledReason({
            provider: controller.providerValue,
            chatMcpEnabledByProvider: desktopCapabilities.chatMcpEnabledByProvider,
          })
        : null,
    [chatMode, controller.providerValue, desktopCapabilities.chatMcpEnabledByProvider],
  )

  const onMcpSessionRestarted = useCallback(
    async (threadId: string) => {
      void controller.refreshThreads()
      await controller.handleSelectThread(threadId)
      setApplyRefreshKey((key) => key + 1)
    },
    [controller],
  )

  const { pendingServerIds: pendingMcpConsent, grantConsent: handleGrantMcpConsent } =
    useChatMcpConsent({
      chatMode,
      mcpDisabledReason,
      workspaceValue: controller.workspaceValue,
      streamGeneration: applyRefreshKey,
      activeThreadId: controller.activeThreadId,
      hasActiveSession:
        (controller.activeThread?.hasActiveSession ?? false) || (controller.turns?.length ?? 0) > 0,
      gateway,
      branchValue: controller.branchValue,
      providerValue: controller.providerValue,
      modelValue: controller.modelValue,
      effortValue: controller.effortValue,
      onSessionRestarted: onMcpSessionRestarted,
    })

  const agentInfoBanner = useMemo(() => {
    if (chatMode !== 'agent') return undefined
    const lines = [t('chat.agentSandboxBanner')]
    if (mcpDisabledReason === 'ollama') lines.push(t('chat.mcpDisabledOllama'))
    else if (mcpDisabledReason === 'provider') lines.push(t('chat.mcpDisabledProvider'))
    return lines.join(' ')
  }, [chatMode, mcpDisabledReason, t])

  const chatApply = useChatSessionApply({
    threadId: controller.activeThreadId,
    expectedSessionId: controller.activeThread?.activeSessionId,
    enabled: chatMode === 'agent' && desktopCapabilities.chatAgentEnabled,
    streamGeneration: applyRefreshKey,
    getChatSessionPendingChanges:
      typeof window.orbit?.getChatSessionPendingChanges === 'function'
        ? window.orbit.getChatSessionPendingChanges.bind(window.orbit)
        : undefined,
    getChatSessionPendingChangeFile:
      typeof window.orbit?.getChatSessionPendingChangeFile === 'function'
        ? window.orbit.getChatSessionPendingChangeFile.bind(window.orbit)
        : undefined,
    applyChatSessionChanges:
      typeof window.orbit?.applyChatSessionChanges === 'function'
        ? window.orbit.applyChatSessionChanges.bind(window.orbit)
        : undefined,
    onSessionMismatch: () => {
      if (controller.activeThreadId) {
        void controller.refreshThreads()
        void controller.handleSelectThread(controller.activeThreadId)
      }
    },
  })

  const handleChatModeChange = useCallback(
    async (nextMode: ChatMode) => {
      if (nextMode === chatMode) return
      setChatModeSwitchError(null)
      const needsConfirm =
        controller.activeThreadId != null &&
        ((controller.turns?.length ?? 0) > 0 ||
          (controller.activeThread?.hasActiveSession ?? false))
      if (needsConfirm) {
        const confirmed = await requestConfirm({
          title: t('chat.modeSwitchConfirmTitle'),
          message: t('chat.modeSwitchConfirmMessage'),
          confirmLabel: t('chat.modeSwitchConfirm'),
          cancelLabel: t('chat.modeSwitchCancel'),
        })
        if (!confirmed) return
      }
      try {
        await controller.changeChatMode(nextMode)
      } catch {
        setChatModeSwitchError(t('chat.modeSwitchFailed'))
      }
    },
    [chatMode, controller, requestConfirm, t],
  )

  useEffect(() => {
    if (controlledMode != null) return
    const coerced = coerceChatModeForCapabilities(storeChatMode, {
      conversationModeEnabled: desktopCapabilities.conversationModeEnabled,
      chatAgentEnabled: desktopCapabilities.chatAgentEnabled,
      provider: controller.providerValue,
      chatAgentSupportByProvider: desktopCapabilities.chatAgentSupportByProvider,
    })
    if (coerced !== storeChatMode) setChatMode(coerced)
  }, [
    controlledMode,
    storeChatMode,
    desktopCapabilities.conversationModeEnabled,
    desktopCapabilities.chatAgentEnabled,
    desktopCapabilities.chatAgentSupportByProvider,
    controller.providerValue,
    setChatMode,
  ])

  useChatAssistHandoff({
    chatAssistHandoff,
    setChatAssistHandoff,
    setChatHandoffError,
    setChatMode: guardedSetChatMode,
    setSelectedWorkflow,
    workspaceValue: controller.workspaceValue,
    branchOptionsCount: controller.branchOptions.length,
    providerOptionsCount: controller.providerOptions.length,
    modelOptionsCount: controller.modelOptions.length,
    startThreadFromHandoff: controller.startThreadFromHandoff,
    handoffNotReadyMessage: t('chat.handoffNotReady'),
    handoffFailedMessage: t('chat.handoffFailed'),
  })

  const sessionMeta = useMemo(() => {
    const workspaceLabel =
      controller.workspaceOptions.find((o) => o.value === controller.workspaceValue)?.label ??
      controller.activeThread?.workspaceLabel ??
      '—'
    const branchLabel =
      controller.branchOptions.find((o) => o.value === controller.branchValue)?.label ??
      (controller.branchValue || '—')
    return {
      workspaceLabel,
      branchLabel,
      modeLabel:
        chatMode === 'spec'
          ? t('chat.modeSpec')
          : chatMode === 'agent'
            ? t('chat.modeAgent')
            : t('chat.modeInteractive'),
    }
  }, [
    controller.workspaceOptions,
    controller.workspaceValue,
    controller.activeThread?.workspaceLabel,
    controller.branchOptions,
    controller.branchValue,
    chatMode,
    t,
  ])

  const suggestions = useMemo(() => {
    const useClarifySuggestions = emptyCopyVariant === 'clarify-first' && chatMode !== 'agent'
    return useClarifySuggestions
      ? [t('chat.suggestionClarifyPrior'), t('chat.suggestionReverseEngineer')]
      : [t('chat.suggestionReview'), t('chat.suggestionInvestigate')]
  }, [chatMode, emptyCopyVariant, t])
  const workspaceRecentOptions = useMemo(
    () => recentWorkspaces.map((workspace) => ({ value: workspace.path, label: workspace.path })),
    [recentWorkspaces],
  )

  const hasActiveThread = controller.activeThreadId !== null
  const handleAddToTaskTurn = useCallback(
    (turn: { id: string; content: string }) => {
      chatToTaskRetryTurnRef.current = turn
      const normalized = normalizeTaskBodyForSubmit(turn.content)
      if (!hasTaskBodyContent(normalized)) {
        setChatToTaskError(t('chat.addToTaskUnavailable'))
        return
      }
      recordChatToTaskMetric('chat_add_to_task_click')
      const clipped = normalized.slice(0, CHAT_TO_TASK_HANDOFF_MAX_CHARS)
      const truncated = normalized.length > CHAT_TO_TASK_HANDOFF_MAX_CHARS
      if (truncated) recordChatToTaskMetric('chat_to_task_handoff_truncated')
      setChatToTaskHandoff({
        body: clipped,
        ...(controller.activeThreadId ? { sourceThreadId: controller.activeThreadId } : {}),
        sourceTurnId: turn.id,
        truncated,
      })
      setPanelVisible('composer', true)
      setActiveView('task')
      setChatToTaskError(null)
    },
    [controller.activeThreadId, setActiveView, setChatToTaskHandoff, setPanelVisible, t],
  )

  const composer = (
    <div className="flex flex-col gap-1">
      {chatHandoffError ? (
        <p className="px-1 text-xs text-[var(--color-status-failed)]" role="alert">
          {chatHandoffError}
        </p>
      ) : null}
      {chatModeSwitchError ? (
        <p className="px-1 text-xs text-[var(--color-status-failed)]" role="alert">
          {chatModeSwitchError}
        </p>
      ) : null}
      {chatToTaskError ? (
        <div className="flex flex-wrap items-center gap-2 px-1" role="alert">
          <p className="text-xs text-[var(--color-status-failed)]">{chatToTaskError}</p>
          {chatToTaskRetryTurnRef.current ? (
            <button
              type="button"
              className="text-xs text-[var(--color-accent)] underline-offset-2 hover:underline"
              onClick={() => {
                recordChatToTaskMetric('chat_to_task_retry')
                const turn = chatToTaskRetryTurnRef.current
                if (turn) handleAddToTaskTurn(turn)
              }}
            >
              {t('chat.addToTaskRetry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {controller.threadReadOnly ? (
        <p className="px-1 text-xs text-[var(--color-muted)]">{t('chat.threadReadOnly')}</p>
      ) : null}
      {controller.compactionNotice ? (
        <p className="px-1 text-xs text-[var(--color-muted)]">{controller.compactionNotice}</p>
      ) : null}
      {chatMode === 'agent' && pendingMcpConsent.length > 0 ? (
        <div className="flex flex-col gap-1.5 px-1">
          {pendingMcpConsent.map((serverId) => (
            <div
              key={serverId}
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text)]"
            >
              <span>{t('chat.mcpConsentRequired', { server: serverId })}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleGrantMcpConsent(serverId)}
              >
                {t('chat.mcpConsentAllow')}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {chatMode === 'agent' && chatApply.pendingFileCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-xs text-[var(--color-text)]">
            {t('chat.applyPendingChip')}:{' '}
            {chatApply.applicableCount < chatApply.pendingFileCount
              ? t('chat.applyPendingChipPartial', {
                  total: String(chatApply.pendingFileCount),
                  applicable: String(chatApply.applicableCount),
                })
              : t('chat.applyPendingChipCount', { count: String(chatApply.pendingFileCount) })}
          </p>
          {chatApply.applicableCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setApplyDialogOpen(true)}
            >
              {t('chat.applyOpenDialog')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ChatComposerForm
        draft={controller.draft}
        onDraftChange={controller.setDraft}
        mode={chatMode}
        onModeChange={handleChatModeChange}
        workspaceOptions={controller.workspaceOptions}
        workspaceValue={controller.workspaceValue}
        onWorkspaceChange={controller.setWorkspaceValue}
        workspaceRecentOptions={workspaceRecentOptions}
        onWorkspaceBrowse={onChangeWorkspace}
        onWorkspaceOpenRecent={
          onOpenRecentWorkspace
            ? async (path) => {
                const switched = await onOpenRecentWorkspace(path)
                if (switched) controller.setWorkspaceValue(path)
              }
            : undefined
        }
        onWorkspaceRemoveRecent={onRemoveRecentWorkspace}
        branchOptions={controller.branchOptions}
        branchValue={controller.branchValue}
        onBranchChange={controller.setBranchValue}
        providerOptions={controller.providerOptions}
        providerValue={controller.providerValue}
        onProviderChange={controller.setProviderValue}
        modelOptions={controller.modelOptions}
        modelValue={controller.modelValue}
        onModelChange={controller.setModelValue}
        effortOptions={controller.effortOptions}
        effortValue={controller.effortValue}
        onEffortChange={controller.setEffortValue}
        hasConversation={(controller.turns?.length ?? 0) > 0}
        sending={controller.sending}
        canSubmit={controller.canSubmit}
        disabled={controller.threadReadOnly}
        autoFocus={!hasActiveThread}
        sendError={controller.streamError}
        onRetrySend={controller.streamError ? () => controller.retrySend() : undefined}
        onCancelSend={controller.canCancelSend ? () => controller.cancelSend() : undefined}
        showCancel={controller.canCancelSend}
        onSend={(intent) => void controller.handleSend(intent)}
        chatAgentEnabled={desktopCapabilities.chatAgentEnabled}
        chatAgentSupportByProvider={desktopCapabilities.chatAgentSupportByProvider}
        hideModeSwitcher={hideModeSwitcher}
        placeholder={
          emptyCopyVariant === 'clarify-first' ? t('chat.composerPlaceholderClarify') : undefined
        }
      />
    </div>
  )

  const specPreviewPane = controller.specPreview ? (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-6">
      <ComposerSummaryPreview
        preview={controller.specPreview}
        onFinalize={async (body) => {
          if (onEnqueueSpec) {
            await onEnqueueSpec(
              buildChatSpecDraft(
                body,
                selectedWorkflow,
                workflowMode,
                controller.modelValue,
                controller.providerValue,
              ),
            )
          }
          controller.dismissSpecPreview()
        }}
        onRunNow={
          onRunNowSpec
            ? async (body) => {
                await onRunNowSpec(
                  buildChatSpecDraft(
                    body,
                    selectedWorkflow,
                    workflowMode,
                    controller.modelValue,
                    controller.providerValue,
                  ),
                )
                controller.dismissSpecPreview()
              }
            : undefined
        }
        onContinue={controller.dismissSpecPreview}
      />
    </div>
  ) : null

  return (
    <>
      {confirmDialog}
      <ChatApplyDiffDialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        pending={chatApply.pending}
        selectedPath={applySelectedPath}
        fileContent={applyFileContent}
        loadingFile={applyFileLoading}
        onSelectFile={setApplySelectedPath}
        onLoadFile={(path) => {
          const load = chatApply.getChatSessionPendingChangeFile
          if (!load) return
          setApplyFileLoading(true)
          void load(path)
            .then((file) => setApplyFileContent(file))
            .finally(() => setApplyFileLoading(false))
        }}
        applying={applying}
        onApply={(paths) => {
          setApplying(true)
          void chatApply
            .applySelected(paths)
            .then((result) => {
              if (result) setApplyDialogOpen(false)
            })
            .finally(() => setApplying(false))
        }}
      />
      <div className={cn('flex min-h-0 flex-1 overflow-hidden', className)}>
        {hideSidebar ? null : sidebarCollapsed ? (
          <div className="flex shrink-0 items-start border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-2">
            <button
              type="button"
              aria-label={t('chat.expandSidebar')}
              onClick={() => setSidebarCollapsed(false)}
              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
            >
              <PanelLeftOpen size={15} />
            </button>
          </div>
        ) : (
          <ChatHistorySidebar
            threads={controller.threads}
            activeThreadId={controller.activeSidebarThreadId}
            searchQuery={controller.search}
            onSearchChange={controller.setSearch}
            onNewChat={controller.handleNewChat}
            onSelectThread={controller.handleSelectThread}
            onCollapse={() => setSidebarCollapsed(true)}
            currentWorkspacePath={controller.workspaceValue || currentWorkspacePath}
            loading={controller.threadsLoading}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {chatStreamBridgeGap.length > 0 ? (
            <div className="shrink-0 border-b border-[var(--color-border)]/70 px-4 py-3">
              <BridgeCapabilityBanner missing={chatStreamBridgeGap} />
            </div>
          ) : null}
          <ChatConversationPane
            hasActiveThread={hasActiveThread}
            turns={controller.turns ?? []}
            inFlightAssistant={controller.inFlightAssistant}
            loadingThread={controller.threadLoading}
            sessionMeta={sessionMeta}
            infoBanner={agentInfoBanner}
            specPreviewPane={specPreviewPane}
            composer={composer}
            suggestions={suggestions}
            onPickSuggestion={controller.setDraft}
            addToTaskLabel={t('chat.addToTask')}
            addToTaskAriaLabel={t('chat.addToTaskAria')}
            onAddToTaskTurn={handleAddToTaskTurn}
            emptyCopyVariant={emptyCopyVariant}
            hideComposer={hideComposer}
          />
        </div>
      </div>
    </>
  )
}

function buildChatSpecDraft(
  body: string,
  selectedWorkflow: string,
  workflowMode: PromptComposerRunDraft['workflowMode'],
  model?: string,
  provider?: string,
): PromptComposerRunDraft {
  const trimmedModel = model?.trim()
  const trimmedProvider = provider?.trim()
  return {
    body,
    workflowMode,
    ...(workflowMode === 'manual' ? { workflow: selectedWorkflow.trim() || undefined } : {}),
    ...(trimmedProvider ? { provider: trimmedProvider } : {}),
    ...(trimmedModel ? { model: trimmedModel } : {}),
  }
}
