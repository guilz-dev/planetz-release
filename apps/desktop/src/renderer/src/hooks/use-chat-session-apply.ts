import {
  CHAT_SESSION_MISMATCH_CODE,
  type ChatSessionApplyChangesResult,
  type ChatSessionPendingChangesResult,
} from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { toErrorMessage } from '../lib/to-error-message.js'
import { usePushToast } from './use-toast'

export type UseChatSessionApplyOptions = {
  threadId: string | null
  expectedSessionId?: string
  enabled: boolean
  streamGeneration: number
  getChatSessionPendingChanges?: (
    input: import('@planetz/shared').ChatSessionThreadInput,
  ) => Promise<ChatSessionPendingChangesResult>
  getChatSessionPendingChangeFile?: (
    input: import('@planetz/shared').ChatSessionPendingChangeFileInput,
  ) => Promise<import('@planetz/shared').ChatSessionPendingChangeFileResult>
  applyChatSessionChanges?: (
    input: import('@planetz/shared').ChatSessionApplyChangesInput,
  ) => Promise<ChatSessionApplyChangesResult>
  onSessionMismatch?: () => void
}

export function useChatSessionApply({
  threadId,
  expectedSessionId,
  enabled,
  streamGeneration: _streamGeneration,
  getChatSessionPendingChanges,
  getChatSessionPendingChangeFile,
  applyChatSessionChanges,
  onSessionMismatch,
}: UseChatSessionApplyOptions) {
  const { t } = useI18n()
  const pushToast = usePushToast()
  const [pending, setPending] = useState<ChatSessionPendingChangesResult | null>(null)
  const [loadingPending, setLoadingPending] = useState(false)
  const requestSeq = useRef(0)

  const refreshPending = useCallback(async () => {
    if (!enabled || !threadId || !getChatSessionPendingChanges) {
      setPending(null)
      return
    }
    const requestId = ++requestSeq.current
    setLoadingPending(true)
    try {
      const result = await getChatSessionPendingChanges({
        threadId,
        expectedSessionId,
      })
      if (requestId !== requestSeq.current) return
      setPending(result)
    } catch (error) {
      if (requestId !== requestSeq.current) return
      setPending(null)
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : ''
      if (code === CHAT_SESSION_MISMATCH_CODE) {
        onSessionMismatch?.()
        return
      }
      pushToast({
        kind: 'error',
        title: t('chat.applyPendingErrorTitle'),
        message: toErrorMessage(error, t('chat.applyPendingError')),
      })
    } finally {
      if (requestId === requestSeq.current) {
        setLoadingPending(false)
      }
    }
  }, [
    enabled,
    expectedSessionId,
    getChatSessionPendingChanges,
    onSessionMismatch,
    pushToast,
    t,
    threadId,
  ])

  useEffect(() => {
    void refreshPending()
  }, [refreshPending])

  const pendingFileCount = pending?.files.length ?? 0
  const applicableCount = pending?.files.filter((file) => file.applicable).length ?? 0

  const applySelected = useCallback(
    async (paths: string[]) => {
      if (!threadId || !applyChatSessionChanges) return null
      try {
        const result = await applyChatSessionChanges({
          threadId,
          expectedSessionId,
          paths,
        })
        if (result.applied.length > 0) {
          pushToast({
            kind: 'success',
            title: t('chat.applySuccessTitle'),
            message: t('chat.applySuccessMessage'),
          })
        } else {
          pushToast({
            kind: 'info',
            title: t('chat.applyNoopTitle'),
            message: t('chat.applyNoopMessage'),
          })
        }
        await refreshPending()
        return result
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code?: unknown }).code)
            : ''
        if (code === CHAT_SESSION_MISMATCH_CODE) {
          onSessionMismatch?.()
          return null
        }
        pushToast({
          kind: 'error',
          title: t('chat.applyErrorTitle'),
          message: toErrorMessage(error, t('chat.applyError')),
        })
        return null
      }
    },
    [
      applyChatSessionChanges,
      expectedSessionId,
      onSessionMismatch,
      pushToast,
      refreshPending,
      t,
      threadId,
    ],
  )

  return {
    pending,
    loadingPending,
    pendingFileCount,
    applicableCount,
    refreshPending,
    applySelected,
    getChatSessionPendingChangeFile:
      threadId && getChatSessionPendingChangeFile
        ? (path: string) => getChatSessionPendingChangeFile({ threadId, path, expectedSessionId })
        : undefined,
  }
}
