import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatGateway } from '../components/chat/chat-types'
import {
  type ChatDraftHistoryItem,
  chatComposerDraftFromSnapshot,
  chatComposerDraftToSnapshot,
} from '../lib/chat-composer-draft-mapper.js'

const DRAFT_PERSIST_DEBOUNCE_MS = 300

export type UseChatComposerDraftPersistenceOptions = {
  gateway: ChatGateway
  persistenceKey: string
  draft: string
  setDraft: (value: string) => void
  providerValue: string
  setProviderValue: (value: string) => void
  modelValue: string
  setModelValue: (value: string) => void
}

export function useChatComposerDraftPersistence({
  gateway,
  persistenceKey,
  draft,
  setDraft,
  providerValue,
  setProviderValue,
  modelValue,
  setModelValue,
}: UseChatComposerDraftPersistenceOptions) {
  const [draftHistory, setDraftHistory] = useState<ChatDraftHistoryItem[]>([])
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)

  const draftHydratedRef = useRef(false)
  const skipDraftSaveRef = useRef(false)
  const persistenceKeyRef = useRef(persistenceKey)
  /**
   * Last provider/model pair written to sidecar KV. Updated only when modelValue is non-empty
   * (user picked a model) or on draft restore — not when the user only changes provider.
   * Prevents persisting e.g. Ollama + a Cursor model still held in UI state mid-switch.
   */
  const persistedProfileRef = useRef({ provider: '', model: '' })

  persistenceKeyRef.current = persistenceKey

  useEffect(() => {
    const model = modelValue.trim()
    if (!model) return
    persistedProfileRef.current = {
      provider: providerValue.trim(),
      model,
    }
  }, [providerValue, modelValue])

  const snapshot = useMemo(() => {
    const activeModel = modelValue.trim()
    // Mid provider switch model is empty: keep the last committed pair in the saved draft.
    const profile = activeModel
      ? { provider: providerValue.trim(), model: activeModel }
      : persistedProfileRef.current
    return chatComposerDraftToSnapshot({
      draft,
      draftHistory,
      activeDraftId,
      providerValue: profile.provider,
      modelValue: profile.model,
    })
  }, [draft, draftHistory, activeDraftId, providerValue, modelValue])

  const flushSave = useCallback(
    (key: string) => {
      if (!key || !gateway.saveComposerDraft || !draftHydratedRef.current) return
      void gateway.saveComposerDraft(snapshot)
    },
    [gateway, snapshot],
  )

  useEffect(() => {
    if (!persistenceKey || !gateway.loadComposerDraft) {
      draftHydratedRef.current = true
      return
    }
    draftHydratedRef.current = false
    skipDraftSaveRef.current = false
    let cancelled = false
    void gateway
      .loadComposerDraft()
      .then((snapshot) => {
        if (cancelled) return
        if (snapshot) {
          skipDraftSaveRef.current = true
          const restored = chatComposerDraftFromSnapshot(snapshot)
          persistedProfileRef.current = {
            provider: restored.providerValue,
            model: restored.modelValue,
          }
          setDraft(restored.draft)
          setProviderValue(restored.providerValue)
          setModelValue(restored.modelValue)
          // Provider changes clear model in composer state; re-apply restored model
          // on the next microtask so persisted selection wins during hydration.
          queueMicrotask(() => {
            if (cancelled) return
            setModelValue(restored.modelValue)
          })
          setDraftHistory(restored.draftHistory)
          setActiveDraftId(restored.activeDraftId)
        }
        draftHydratedRef.current = true
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.debug('chat composer draft load failed', error)
        draftHydratedRef.current = true
      })
    return () => {
      cancelled = true
    }
  }, [persistenceKey, gateway, setDraft, setProviderValue, setModelValue])

  useEffect(() => {
    if (!persistenceKey || !gateway.saveComposerDraft) return
    if (!draftHydratedRef.current) return
    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false
      return
    }
    const keyAtMount = persistenceKey
    const timer = setTimeout(() => {
      flushSave(keyAtMount)
    }, DRAFT_PERSIST_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      if (keyAtMount === persistenceKeyRef.current) {
        flushSave(keyAtMount)
      }
    }
  }, [persistenceKey, gateway, flushSave])

  return {
    draftHistory,
    setDraftHistory,
    activeDraftId,
    setActiveDraftId,
  }
}
