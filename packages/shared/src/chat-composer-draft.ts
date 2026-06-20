import { z } from 'zod'

/** Max unsent composer drafts kept in the sidebar history list. */
export const CHAT_COMPOSER_DRAFT_HISTORY_LIMIT = 30

/** Max characters for a draft title derived from the first line of body text. */
export const CHAT_COMPOSER_DRAFT_TITLE_MAX = 56

export function chatDraftWorkspaceLabelFromPath(workspacePath: string): string {
  const normalized = workspacePath.trim()
  if (!normalized) return 'workspace'
  const parts = normalized.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

export function summarizeChatDraftTitle(text: string): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  const normalized = firstLine ?? text.trim()
  if (normalized.length <= CHAT_COMPOSER_DRAFT_TITLE_MAX) return normalized
  return `${normalized.slice(0, CHAT_COMPOSER_DRAFT_TITLE_MAX - 1).trimEnd()}…`
}

export const chatComposerDraftHistoryItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string(),
  workspacePath: z.string(),
  workspaceLabel: z.string(),
  updatedAt: z.string(),
  body: z.string(),
})

export const chatComposerDraftSnapshotSchema = z.object({
  draft: z.string(),
  activeDraftId: z.string().nullable().optional(),
  selectedProvider: z.string().trim().min(1).optional(),
  selectedModel: z.string().trim().min(1).optional(),
  items: z.array(chatComposerDraftHistoryItemSchema).max(CHAT_COMPOSER_DRAFT_HISTORY_LIMIT),
  updatedAt: z.string(),
})

export type ChatComposerDraftHistoryItem = z.infer<typeof chatComposerDraftHistoryItemSchema>
export type ChatComposerDraftSnapshot = z.infer<typeof chatComposerDraftSnapshotSchema>
