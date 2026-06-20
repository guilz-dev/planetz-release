import {
  type ConversationEntry,
  conversationEntrySchema,
  type PromptHistoryItem,
  promptHistoryItemSchema,
  redactAutoDecisionForStorage,
  redactSecrets,
  retryContextSchema,
} from '@planetz/shared'
import type { z } from 'zod'
import { parseSidecarRecord } from './sidecar-record-parse.js'

export type RetryContextRecord = z.infer<typeof retryContextSchema>

export function buildConversationEntry(
  input: Omit<ConversationEntry, 'id' | 'createdAt'>,
): ConversationEntry {
  return parseSidecarRecord(
    {
      ...input,
      id: `conv_${crypto.randomUUID()}`,
      body: redactSecrets(input.body),
      createdAt: new Date().toISOString(),
    },
    conversationEntrySchema,
    'conversation',
  )
}

export function buildSubmittedPromptHistoryItem(input: {
  title: string
  body: string
  workflow?: string
  autoDecision?: PromptHistoryItem['autoDecision']
  assignedAgentId?: string
  issueRef?: string
  submittedTaskId: string
}): PromptHistoryItem {
  const now = new Date().toISOString()
  return parseSidecarRecord(
    {
      id: `prompt_${crypto.randomUUID()}`,
      title: redactSecrets(input.title),
      body: redactSecrets(input.body),
      workflow: input.workflow,
      autoDecision: input.autoDecision
        ? redactAutoDecisionForStorage(input.autoDecision)
        : undefined,
      assignedAgentId: input.assignedAgentId,
      issueRef: input.issueRef,
      submittedTaskId: input.submittedTaskId,
      status: 'submitted',
      createdAt: now,
      updatedAt: now,
    },
    promptHistoryItemSchema,
    'prompt history',
  )
}

export function parseRetryContextRecord(record: RetryContextRecord): RetryContextRecord {
  return parseSidecarRecord(record, retryContextSchema, 'retry context')
}
