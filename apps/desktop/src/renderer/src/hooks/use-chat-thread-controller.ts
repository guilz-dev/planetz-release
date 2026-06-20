import { useCallback, useMemo } from 'react'
import type { ChatGateway } from '../components/chat/chat-types'
import { filterChatThreadsByTitle, mergeThreadsForSendLookup } from '../lib/chat-thread-search'
import type { ChatMode } from '../types/chat-mode'
import { useChatComposerState } from './use-chat-composer-state.js'
import { useChatThreadQuery } from './use-chat-thread-query.js'
import { useChatThreadSend } from './use-chat-thread-send.js'

export type UseChatThreadControllerOptions = {
  gateway: ChatGateway
  chatMode: ChatMode
  setChatMode: (mode: ChatMode) => void
  currentWorkspacePath?: string
  allowedProviders?: ReadonlyArray<string>
}

export function useChatThreadController({
  gateway,
  chatMode,
  setChatMode,
  currentWorkspacePath,
  allowedProviders,
}: UseChatThreadControllerOptions) {
  const composer = useChatComposerState({ gateway, currentWorkspacePath, allowedProviders })
  const query = useChatThreadQuery({
    gateway,
    workspacePath: composer.workspaceValue || undefined,
  })
  const baseThreadSummariesForLookup = useMemo(
    () => mergeThreadsForSendLookup(query.allThreads, query.threads),
    [query.allThreads, query.threads],
  )
  const send = useChatThreadSend({
    gateway,
    chatMode,
    setChatMode,
    currentWorkspacePath,
    threadSummariesForLookup: baseThreadSummariesForLookup,
    refreshThreads: query.refreshThreads,
    draft: composer.draft,
    setDraft: composer.setDraft,
    setSpecPreview: composer.setSpecPreview,
    workspaceValue: composer.workspaceValue,
    branchValue: composer.branchValue,
    providerValue: composer.providerValue,
    setProviderValue: composer.setProviderValue,
    modelValue: composer.modelValue,
    setModelValue: composer.setModelValue,
    effortValue: composer.effortValue,
    canStartThread: composer.canStartThread,
    setWorkspaceValue: composer.setWorkspaceValue,
  })
  const threads = useMemo(() => {
    const draftMatches = filterChatThreadsByTitle(send.draftHistoryThreads, query.search)
    return mergeThreadsForSendLookup(draftMatches, query.threads)
  }, [send.draftHistoryThreads, query.search, query.threads])
  const setProviderValue = useCallback(
    (value: string) => {
      composer.setProviderValue(value)
      send.markSessionConfigDirty()
    },
    [composer.setProviderValue, send.markSessionConfigDirty],
  )
  const setModelValue = useCallback(
    (value: string) => {
      composer.setModelValue(value)
      send.markSessionConfigDirty()
    },
    [composer.setModelValue, send.markSessionConfigDirty],
  )
  const setEffortValue = useCallback(
    (value: string) => {
      composer.setEffortValue(value)
      send.markSessionConfigDirty()
    },
    [composer.setEffortValue, send.markSessionConfigDirty],
  )

  return {
    threads,
    threadsLoading: query.threadsLoading,
    activeThreadId: send.activeThreadId,
    activeSidebarThreadId: send.activeSidebarThreadId,
    turns: send.turns ?? [],
    streamingTurn: send.streamingTurn,
    threadLoading: send.threadLoading,
    sending: send.sending,
    inFlightAssistant: send.inFlightAssistant,
    canCancelSend: send.canCancelSend,
    streamState: send.streamState,
    streamError: send.streamError,
    compactionNotice: send.compactionNotice,
    cancelSend: send.cancelSend,
    retrySend: send.retrySend,
    startThreadFromHandoff: send.startThreadFromHandoff,
    draft: composer.draft,
    setDraft: composer.setDraft,
    search: query.search,
    setSearch: query.setSearch,
    specPreview: composer.specPreview,
    dismissSpecPreview: composer.dismissSpecPreview,
    workspaceOptions: composer.workspaceOptions,
    branchOptions: composer.branchOptions,
    providerOptions: composer.providerOptions,
    modelOptions: composer.modelOptions,
    effortOptions: composer.effortOptions,
    workspaceValue: composer.workspaceValue,
    setWorkspaceValue: composer.setWorkspaceValue,
    branchValue: composer.branchValue,
    setBranchValue: composer.setBranchValue,
    providerValue: composer.providerValue,
    setProviderValue,
    modelValue: composer.modelValue,
    setModelValue,
    effortValue: composer.effortValue,
    setEffortValue,
    canStartThread: composer.canStartThread,
    activeThread: send.activeThread,
    threadReadOnly: send.threadReadOnly,
    canSubmit: send.canSubmit,
    refreshThreads: query.refreshThreads,
    handleSelectThread: send.handleSelectThread,
    changeChatMode: send.changeChatMode,
    handleNewChat: send.handleNewChat,
    handleSend: send.handleSend,
  }
}
