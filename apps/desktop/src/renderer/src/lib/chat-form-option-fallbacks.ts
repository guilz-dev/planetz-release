import type { ChatSelectOption } from '../components/chat/chat-types'

/** Neutral fallbacks when engine/catalog/branch IPC are unavailable (not mock gateway data). */
export const CHAT_FORM_FALLBACK_BRANCH_OPTIONS: ChatSelectOption[] = [
  { value: 'develop', label: 'develop' },
  { value: 'main', label: 'main' },
  { value: 'feature/chat-mode', label: 'feature/chat-mode' },
]

export const CHAT_FORM_FALLBACK_PROVIDER_OPTIONS: ChatSelectOption[] = [
  { value: 'claude-sdk', label: 'Claude (API)' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'codex', label: 'Codex' },
]

export const CHAT_FORM_FALLBACK_MODEL_OPTIONS: ChatSelectOption[] = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8' },
  { value: 'codex-5.3', label: '5.3-Codex' },
]
