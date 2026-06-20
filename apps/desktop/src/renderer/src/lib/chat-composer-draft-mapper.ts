import type { ChatComposerDraftSnapshot } from '@planetz/shared'
import { chatDraftWorkspaceLabelFromPath, summarizeChatDraftTitle } from '@planetz/shared'
import type { ChatThreadSummary } from '../components/chat/chat-types'

export interface ChatDraftHistoryItem {
  summary: ChatThreadSummary
  body: string
}

export function chatComposerDraftToSnapshot(input: {
  draft: string
  draftHistory: ChatDraftHistoryItem[]
  activeDraftId: string | null
  providerValue: string
  modelValue: string
}): ChatComposerDraftSnapshot {
  const providerValue = input.providerValue.trim()
  const modelValue = input.modelValue.trim()
  return {
    draft: input.draft,
    activeDraftId: input.activeDraftId,
    ...(providerValue ? { selectedProvider: providerValue } : {}),
    ...(modelValue ? { selectedModel: modelValue } : {}),
    items: input.draftHistory.map((entry) => ({
      id: entry.summary.id,
      title: entry.summary.title,
      workspacePath: entry.summary.workspacePath,
      workspaceLabel: entry.summary.workspaceLabel,
      updatedAt: entry.summary.updatedAt,
      body: entry.body,
    })),
    updatedAt: new Date().toISOString(),
  }
}

export function chatComposerDraftFromSnapshot(snapshot: ChatComposerDraftSnapshot): {
  draft: string
  draftHistory: ChatDraftHistoryItem[]
  activeDraftId: string | null
  providerValue: string
  modelValue: string
} {
  return {
    draft: snapshot.draft,
    activeDraftId: snapshot.activeDraftId ?? null,
    providerValue: snapshot.selectedProvider?.trim() ?? '',
    modelValue: snapshot.selectedModel?.trim() ?? '',
    draftHistory: snapshot.items.map((item) => ({
      summary: {
        id: item.id,
        title: item.title,
        workspacePath: item.workspacePath,
        workspaceLabel: item.workspaceLabel,
        updatedAt: item.updatedAt,
        hasActiveSession: false,
      },
      body: item.body,
    })),
  }
}

export function buildChatDraftHistorySummary(input: {
  id: string
  body: string
  workspacePath: string
  updatedAt: string
}): ChatThreadSummary {
  return {
    id: input.id,
    title: summarizeChatDraftTitle(input.body),
    workspacePath: input.workspacePath,
    workspaceLabel: chatDraftWorkspaceLabelFromPath(input.workspacePath),
    updatedAt: input.updatedAt,
    hasActiveSession: false,
  }
}
