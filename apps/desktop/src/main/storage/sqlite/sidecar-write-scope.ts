import type {
  AutoWorkflowDecision,
  ConversationEntry,
  TaskViewModel,
  TaskWorkflowSelectionMeta,
  UiState,
  WorkflowRoutingAuditRecord,
} from '@planetz/shared'
import { PROMPT_HISTORY_MAX_ITEMS } from '@planetz/shared'
import { writeMockQueueSnapshot } from '../../sidecar/mock-queue-snapshot.js'
import {
  buildConversationEntry,
  buildSubmittedPromptHistoryItem,
  parseRetryContextRecord,
  type RetryContextRecord,
} from '../../sidecar/sidecar-entry-builders.js'
import type { SidecarPaths } from '../../sidecar/sidecar-paths.js'
import { writeUiStateKv } from '../../sidecar/ui-state-kv.js'
import { getSidecarSqlite } from './connection.js'
import { insertConversation } from './repositories/conversation-repository.js'
import { insertPromptHistory, trimPromptHistory } from './repositories/prompt-history-repository.js'
import { insertRetryContext } from './repositories/retry-context-repository.js'
import { insertTaskWorkflowSelectionMeta } from './repositories/task-workflow-selection-meta-repository.js'
import { insertWorkflowRoutingAudit } from './repositories/workflow-routing-audit-repository.js'
import { runSidecarTransaction } from './transaction.js'

export type EnqueuePersistInput = {
  mode: 'mock' | 'production'
  mockTasks?: TaskViewModel[]
  conversation: Omit<ConversationEntry, 'id' | 'createdAt'>
  promptHistory: {
    title: string
    body: string
    workflow?: string
    autoDecision?: AutoWorkflowDecision
    assignedAgentId?: string
    issueRef?: string
    submittedTaskId: string
  }
  uiState: UiState
  routingAudit?: WorkflowRoutingAuditRecord
  workflowSelectionMeta?: TaskWorkflowSelectionMeta
}

export type DerivePersistInput = {
  mode: 'mock' | 'production'
  mockTasks?: TaskViewModel[]
  conversation: Omit<ConversationEntry, 'id' | 'createdAt'>
  retryContext: RetryContextRecord
  uiState: UiState
}

function assertEnqueueTaskIds(input: EnqueuePersistInput): void {
  if (input.promptHistory.submittedTaskId !== input.conversation.taskId) {
    throw new Error('enqueue persist input task id mismatch')
  }
  if (input.mode === 'mock' && !input.mockTasks) {
    throw new Error('mock enqueue persist requires mockTasks')
  }
}

function assertDeriveTaskIds(input: DerivePersistInput): void {
  if (input.retryContext.taskId !== input.conversation.taskId) {
    throw new Error('derive persist input task id mismatch')
  }
  if (input.mode === 'mock' && !input.mockTasks) {
    throw new Error('mock derive persist requires mockTasks')
  }
}

export async function persistEnqueueSidecar(
  paths: SidecarPaths,
  input: EnqueuePersistInput,
): Promise<void> {
  assertEnqueueTaskIds(input)
  const db = await getSidecarSqlite(paths)
  const conversation = buildConversationEntry(input.conversation)
  const promptItem = buildSubmittedPromptHistoryItem(input.promptHistory)

  runSidecarTransaction(db, () => {
    if (input.mode === 'mock') {
      writeMockQueueSnapshot(db, input.mockTasks as TaskViewModel[])
    }
    insertConversation(db, conversation)
    insertPromptHistory(db, promptItem)
    trimPromptHistory(db, PROMPT_HISTORY_MAX_ITEMS)
    if (input.routingAudit) {
      insertWorkflowRoutingAudit(db, input.promptHistory.submittedTaskId, input.routingAudit)
    }
    if (input.workflowSelectionMeta) {
      insertTaskWorkflowSelectionMeta(
        db,
        input.promptHistory.submittedTaskId,
        input.workflowSelectionMeta,
        new Date().toISOString(),
      )
    }
    writeUiStateKv(db, input.uiState)
  })
}

export async function persistDeriveSidecar(
  paths: SidecarPaths,
  input: DerivePersistInput,
): Promise<void> {
  assertDeriveTaskIds(input)
  const db = await getSidecarSqlite(paths)
  const conversation = buildConversationEntry(input.conversation)
  const retryContext = parseRetryContextRecord(input.retryContext)

  runSidecarTransaction(db, () => {
    if (input.mode === 'mock') {
      writeMockQueueSnapshot(db, input.mockTasks as TaskViewModel[])
    }
    insertConversation(db, conversation)
    insertRetryContext(db, retryContext)
    writeUiStateKv(db, input.uiState)
  })
}
