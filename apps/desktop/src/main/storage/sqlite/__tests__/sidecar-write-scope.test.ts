import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UiState } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { writeMockQueueSnapshot } from '../../../sidecar/mock-queue-snapshot.js'
import { UI_STATE_KV_KEY } from '../../../sidecar/sidecar-kv-keys.js'
import type { SidecarPaths } from '../../../sidecar/sidecar-paths.js'
import * as uiStateKv from '../../../sidecar/ui-state-kv.js'
import { closeAllSidecarSqlite, getSidecarSqlite } from '../connection.js'
import { readKvJson } from '../kv-store.js'
import { listConversationsForTask } from '../repositories/conversation-repository.js'
import { countMockTasks } from '../repositories/mock-tasks-repository.js'
import * as promptHistoryRepository from '../repositories/prompt-history-repository.js'
import { listPromptHistory } from '../repositories/prompt-history-repository.js'
import { listRetryContexts } from '../repositories/retry-context-repository.js'
import { persistDeriveSidecar, persistEnqueueSidecar } from '../sidecar-write-scope.js'

const SAMPLE_TASK = {
  id: 'task-seed',
  title: 'Seed',
  body: 'seed body',
  priority: 'normal' as const,
  status: 'pending' as const,
  source: 'user' as const,
  createdAt: '2026-05-27T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
}

const NEW_TASK = {
  ...SAMPLE_TASK,
  id: 'task-new',
  title: 'New task',
  createdAt: '2026-05-27T01:00:00.000Z',
  updatedAt: '2026-05-27T01:00:00.000Z',
}

async function seedDb(
  paths: SidecarPaths,
  uiState: UiState = { selectedTaskId: 'task-seed' },
): Promise<void> {
  const db = await getSidecarSqlite(paths)
  writeMockQueueSnapshot(db, [SAMPLE_TASK])
  uiStateKv.writeUiStateKv(db, uiState)
}

describe('sidecar-write-scope', () => {
  let dir: string
  let paths: SidecarPaths

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sidecar-write-scope-'))
    paths = mockSidecarPaths(dir)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    closeAllSidecarSqlite()
    await rm(dir, { recursive: true, force: true })
  })

  it('persistEnqueueSidecar (mock) writes mock_tasks, conversation, prompt, ui.state atomically', async () => {
    await persistEnqueueSidecar(paths, {
      mode: 'mock',
      mockTasks: [NEW_TASK, SAMPLE_TASK],
      conversation: {
        taskId: 'task-new',
        role: 'user',
        kind: 'initial_order',
        body: 'Do work',
      },
      promptHistory: {
        title: 'New task',
        body: 'Do work',
        issueRef: 'guilz-dev/planetz#368',
        submittedTaskId: 'task-new',
      },
      uiState: { selectedTaskId: 'task-new' },
    })

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(2)
    expect(listConversationsForTask(db, 'task-new')).toHaveLength(1)
    expect(listPromptHistory(db, 10)).toHaveLength(1)
    expect(listPromptHistory(db, 10)[0]?.issueRef).toBe('guilz-dev/planetz#368')
    expect(readKvJson(db, UI_STATE_KV_KEY)).toEqual({ selectedTaskId: 'task-new' })
  })

  it('persistEnqueueSidecar (production) does not change mock_tasks', async () => {
    await seedDb(paths)

    await persistEnqueueSidecar(paths, {
      mode: 'production',
      conversation: {
        taskId: 'queued-prod',
        role: 'user',
        kind: 'initial_order',
        body: 'Prod body',
      },
      promptHistory: {
        title: 'Prod',
        body: 'Prod body',
        submittedTaskId: 'queued-prod',
      },
      uiState: { selectedTaskId: 'queued-prod' },
    })

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(1)
    expect(listConversationsForTask(db, 'queued-prod')).toHaveLength(1)
  })

  it('persistDeriveSidecar (mock) writes mock_tasks, conversation, retry, ui.state', async () => {
    await persistDeriveSidecar(paths, {
      mode: 'mock',
      mockTasks: [NEW_TASK, SAMPLE_TASK],
      conversation: {
        taskId: 'task-new',
        role: 'user',
        kind: 'retry',
        body: 'retry prompt',
      },
      retryContext: {
        taskId: 'task-new',
        originTaskId: 'task-seed',
        kind: 'retry',
        createdAt: '2026-05-27T02:00:00.000Z',
      },
      uiState: { selectedTaskId: 'task-new' },
    })

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(2)
    expect(listConversationsForTask(db, 'task-new')).toHaveLength(1)
    expect(listRetryContexts(db)).toHaveLength(1)
    expect(readKvJson(db, UI_STATE_KV_KEY)).toEqual({ selectedTaskId: 'task-new' })
  })

  it('persistDeriveSidecar (production) writes conversation and retry without mock_tasks', async () => {
    await seedDb(paths)

    await persistDeriveSidecar(paths, {
      mode: 'production',
      conversation: {
        taskId: 'derived-prod',
        role: 'user',
        kind: 'revise',
        body: 'revise prompt',
      },
      retryContext: {
        taskId: 'derived-prod',
        originTaskId: 'task-seed',
        kind: 'revise',
        createdAt: '2026-05-27T02:00:00.000Z',
      },
      uiState: { selectedTaskId: 'derived-prod' },
    })

    const db = await getSidecarSqlite(paths)
    expect(countMockTasks(db)).toBe(1)
    expect(listRetryContexts(db)).toHaveLength(1)
  })

  it('throws on enqueue task id mismatch without persisting', async () => {
    await seedDb(paths)
    const db = await getSidecarSqlite(paths)
    const mockCountBefore = countMockTasks(db)
    const conversationsBefore = listConversationsForTask(db, 'task-new').length

    await expect(
      persistEnqueueSidecar(paths, {
        mode: 'production',
        conversation: {
          taskId: 'task-a',
          role: 'user',
          kind: 'initial_order',
          body: 'body',
        },
        promptHistory: {
          title: 'T',
          body: 'body',
          submittedTaskId: 'task-b',
        },
        uiState: { selectedTaskId: 'task-a' },
      }),
    ).rejects.toThrow(/task id mismatch/)

    expect(countMockTasks(db)).toBe(mockCountBefore)
    expect(listConversationsForTask(db, 'task-a')).toHaveLength(conversationsBefore)
  })

  it('rolls back enqueue when trimPromptHistory throws', async () => {
    await seedDb(paths)
    const db = await getSidecarSqlite(paths)
    const mockCountBefore = countMockTasks(db)
    const uiBefore = readKvJson(db, UI_STATE_KV_KEY)

    vi.spyOn(promptHistoryRepository, 'trimPromptHistory').mockImplementation(() => {
      throw new Error('simulated trim failure')
    })

    await expect(
      persistEnqueueSidecar(paths, {
        mode: 'mock',
        mockTasks: [NEW_TASK],
        conversation: {
          taskId: 'task-new',
          role: 'user',
          kind: 'initial_order',
          body: 'body',
        },
        promptHistory: {
          title: 'T',
          body: 'body',
          submittedTaskId: 'task-new',
        },
        uiState: { selectedTaskId: 'task-new' },
      }),
    ).rejects.toThrow('simulated trim failure')

    expect(countMockTasks(db)).toBe(mockCountBefore)
    expect(listConversationsForTask(db, 'task-new')).toHaveLength(0)
    expect(readKvJson(db, UI_STATE_KV_KEY)).toEqual(uiBefore)
  })

  it('rolls back derive when writeUiStateKv throws', async () => {
    await seedDb(paths)
    const db = await getSidecarSqlite(paths)
    const retryBefore = listRetryContexts(db).length

    vi.spyOn(uiStateKv, 'writeUiStateKv').mockImplementation(() => {
      throw new Error('simulated ui state failure')
    })

    await expect(
      persistDeriveSidecar(paths, {
        mode: 'production',
        conversation: {
          taskId: 'derived-1',
          role: 'user',
          kind: 'retry',
          body: 'retry',
        },
        retryContext: {
          taskId: 'derived-1',
          originTaskId: 'task-seed',
          kind: 'retry',
          createdAt: '2026-05-27T03:00:00.000Z',
        },
        uiState: { selectedTaskId: 'derived-1' },
      }),
    ).rejects.toThrow('simulated ui state failure')

    expect(listRetryContexts(db)).toHaveLength(retryBefore)
    expect(listConversationsForTask(db, 'derived-1')).toHaveLength(0)
  })

  it('persistEnqueueSidecar round-trips autoDecision on prompt_history', async () => {
    await persistEnqueueSidecar(paths, {
      mode: 'production',
      conversation: {
        taskId: 'task-auto',
        role: 'user',
        kind: 'initial_order',
        body: 'Auto routed body',
      },
      promptHistory: {
        title: 'Auto task',
        body: 'Auto routed body',
        workflow: 'default',
        submittedTaskId: 'task-auto',
        autoDecision: {
          selectedWorkflow: 'default',
          group: 'general',
          confidence: 'high',
          score: 0.9,
          fallbackApplied: false,
          alternatives: [],
          reasonCodes: ['llm:routing'],
        },
      },
      uiState: { selectedTaskId: 'task-auto' },
    })

    const db = await getSidecarSqlite(paths)
    const items = listPromptHistory(db, 10)
    expect(items[0]?.autoDecision?.selectedWorkflow).toBe('default')
    expect(items[0]?.autoDecision?.confidence).toBe('high')
  })
})
