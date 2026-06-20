/** Allowed values for `conversation_threads.status` (must match SQLite CHECK). */
export const CONVERSATION_THREAD_STATUSES = ['open', 'archived'] as const

export type ConversationThreadStatus = (typeof CONVERSATION_THREAD_STATUSES)[number]

export const DEFAULT_CONVERSATION_THREAD_STATUS: ConversationThreadStatus = 'open'

export const ARCHIVED_CONVERSATION_THREAD_STATUS: ConversationThreadStatus = 'archived'
