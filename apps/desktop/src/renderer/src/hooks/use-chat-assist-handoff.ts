import { useEffect, useRef } from 'react'
import {
  type ChatHandoffStartResult,
  resolveChatHandoffErrorMessage,
} from '../lib/chat-assist-handoff.js'
import type { ChatAssistHandoff } from '../store/app-store'
import type { ChatMode } from '../types/chat-mode'

export type UseChatAssistHandoffOptions = {
  chatAssistHandoff: ChatAssistHandoff | null
  setChatAssistHandoff: (handoff: ChatAssistHandoff | null) => void
  setChatHandoffError: (message: string | null) => void
  setChatMode: (mode: ChatMode) => void
  setSelectedWorkflow: (workflow: string) => void
  workspaceValue: string
  branchOptionsCount: number
  providerOptionsCount: number
  modelOptionsCount: number
  startThreadFromHandoff: (handoff: ChatAssistHandoff) => Promise<ChatHandoffStartResult>
  handoffNotReadyMessage: string
  handoffFailedMessage: string
}

/**
 * Consumes a one-shot Issue/task → Chat handoff after workspace and form options are ready.
 * Avoids racing ChatView mount before getFormOptions resolves.
 */
export function useChatAssistHandoff({
  chatAssistHandoff,
  setChatAssistHandoff,
  setChatHandoffError,
  setChatMode,
  setSelectedWorkflow,
  workspaceValue,
  branchOptionsCount,
  providerOptionsCount,
  modelOptionsCount,
  startThreadFromHandoff,
  handoffNotReadyMessage,
  handoffFailedMessage,
}: UseChatAssistHandoffOptions): void {
  const pendingRef = useRef<ChatAssistHandoff | null>(null)

  useEffect(() => {
    if (!chatAssistHandoff) return
    pendingRef.current = chatAssistHandoff
    setChatAssistHandoff(null)
    setChatHandoffError(null)
    setChatMode('interactive')
    if (chatAssistHandoff.workflow?.trim()) {
      setSelectedWorkflow(chatAssistHandoff.workflow.trim())
    }
  }, [
    chatAssistHandoff,
    setChatAssistHandoff,
    setChatHandoffError,
    setChatMode,
    setSelectedWorkflow,
  ])

  useEffect(() => {
    const handoff = pendingRef.current
    if (!handoff) return

    const workspaceReady = Boolean(handoff.workspacePath?.trim() || workspaceValue.trim())
    const formReady = branchOptionsCount > 0 && providerOptionsCount > 0 && modelOptionsCount > 0
    if (!workspaceReady || !formReady) return

    pendingRef.current = null
    void startThreadFromHandoff(handoff).then((result) => {
      if (result.ok) {
        setChatHandoffError(null)
        return
      }
      pendingRef.current = handoff
      setChatHandoffError(
        resolveChatHandoffErrorMessage(result.message, {
          notReady: handoffNotReadyMessage,
          failed: handoffFailedMessage,
        }),
      )
    })
  }, [
    workspaceValue,
    branchOptionsCount,
    providerOptionsCount,
    modelOptionsCount,
    startThreadFromHandoff,
    setChatHandoffError,
    handoffNotReadyMessage,
    handoffFailedMessage,
  ])
}
