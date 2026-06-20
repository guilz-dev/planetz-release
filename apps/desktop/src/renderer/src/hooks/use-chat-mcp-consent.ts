import type { ChatMcpDisabledReason } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'
import type { ChatGateway } from '../components/chat/chat-types'
import { useI18n } from '../i18n'
import { toErrorMessage } from '../lib/to-error-message.js'
import type { ChatMode } from '../types/chat-mode'
import { usePushToast } from './use-toast'

export type UseChatMcpConsentOptions = {
  chatMode: ChatMode
  mcpDisabledReason: ChatMcpDisabledReason | null
  workspaceValue: string
  streamGeneration: number
  activeThreadId: string | null
  hasActiveSession: boolean
  gateway: ChatGateway
  branchValue: string
  providerValue: string
  modelValue: string
  effortValue: string
  onSessionRestarted: (threadId: string) => void | Promise<void>
}

export function useChatMcpConsent({
  chatMode,
  mcpDisabledReason,
  workspaceValue,
  streamGeneration: _streamGeneration,
  activeThreadId,
  hasActiveSession,
  gateway,
  branchValue,
  providerValue,
  modelValue,
  effortValue,
  onSessionRestarted,
}: UseChatMcpConsentOptions) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [pendingServerIds, setPendingServerIds] = useState<string[]>([])

  const refreshPending = useCallback(async () => {
    if (
      chatMode !== 'agent' ||
      mcpDisabledReason ||
      typeof window.orbit?.listChatMcpPendingConsent !== 'function'
    ) {
      setPendingServerIds([])
      return
    }
    try {
      const result = await window.orbit.listChatMcpPendingConsent()
      setPendingServerIds(result.serverIds)
    } catch {
      setPendingServerIds([])
    }
  }, [chatMode, mcpDisabledReason])

  useEffect(() => {
    void refreshPending()
  }, [refreshPending])

  const grantConsent = useCallback(
    async (serverId: string) => {
      if (typeof window.orbit?.grantChatMcpConsent !== 'function') return
      await window.orbit.grantChatMcpConsent({ serverId })
      await refreshPending()
      pushToast({
        kind: 'info',
        title: t('chat.mcpConsentGrantedTitle'),
        message: t('chat.mcpConsentRestartHint'),
      })
      if (
        chatMode !== 'agent' ||
        !activeThreadId ||
        !hasActiveSession ||
        !gateway.restartThreadSession
      ) {
        return
      }
      try {
        await gateway.restartThreadSession({
          threadId: activeThreadId,
          mode: 'agent',
          workspacePath: workspaceValue,
          branch: branchValue,
          provider: providerValue,
          model: modelValue,
          effort: effortValue,
        })
        await onSessionRestarted(activeThreadId)
      } catch (error) {
        pushToast({
          kind: 'error',
          title: t('chat.mcpConsentRestartFailedTitle'),
          message: toErrorMessage(error, t('chat.mcpConsentRestartFailed')),
        })
      }
    },
    [
      activeThreadId,
      branchValue,
      chatMode,
      effortValue,
      gateway,
      hasActiveSession,
      modelValue,
      onSessionRestarted,
      providerValue,
      pushToast,
      refreshPending,
      t,
      workspaceValue,
    ],
  )

  return { pendingServerIds, grantConsent }
}
