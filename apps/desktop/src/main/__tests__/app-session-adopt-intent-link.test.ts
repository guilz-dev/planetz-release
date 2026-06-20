import { DEFAULT_CONFIG, type UiConfig } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import { AppSession } from '../app-session.js'
import type { IntentLedgerRecord } from '../storage/sqlite/repositories/intent-ledger-repository.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

function configForTest(): UiConfig {
  return {
    ...DEFAULT_CONFIG,
    watch: { autoStart: true },
    ui: { ...DEFAULT_CONFIG.ui },
  }
}

function createSession(): AppSession {
  const session = new AppSession()
  session.workspacePath = '/tmp/ws'
  session.sidecarPaths = mockSidecarPaths('/tmp/ws/.orbit')
  session.config = configForTest()
  session.cachedState = {
    tasks: [{ id: 'task-1', title: 'Task', status: 'completed' }],
  } as never
  return session
}

function adoptedEntry(): IntentLedgerRecord {
  return {
    id: 'task-1:run-a:obs-1',
    taskId: 'task-1',
    sourceRun: 'run-a',
    decisionId: 'obs-1',
    statement: 'Session switch discards drafts',
    authority: 'observed',
    scopeHint: null,
    sourceDoc: null,
    sourceRunDoc: null,
    createdAt: '2026-06-16T00:00:00.000Z',
    ratifiedAt: null,
    reversibility: null,
    satisfies: null,
    deviates: null,
    adjudicationKind: null,
    adjudicationReason: null,
    promotedReqId: null,
  }
}

describe('AppSession.adoptIntentLedgerEntry', () => {
  it('creates a requirement intent link for promoted requirements when thread and intent exist', async () => {
    const session = createSession()
    vi.spyOn(session, 'requireTaktRepoPath').mockReturnValue('/tmp/ws')
    vi.spyOn(session.intentLedgerStore, 'getById').mockResolvedValue(adoptedEntry())
    vi.spyOn(session.intentLedgerStore, 'adopt').mockResolvedValue(true)
    vi.spyOn(session.intentLedgerStore, 'setPromotedReqId').mockResolvedValue(true)
    vi.spyOn(session.requirementsPromotionService, 'promoteAdoptedEntry').mockResolvedValue({
      status: 'promoted',
      reqId: 'REQ-auth-2',
      requirementsPath: '/tmp/ws/runs/run-a/reports/requirements.md',
    })
    vi.spyOn(session.taskThreadLinkStore, 'getThreadId').mockResolvedValue('thread-1')
    vi.spyOn(session.decidedIntentStore, 'getCurrent').mockResolvedValue({
      id: 'thread-1#v4',
      threadId: 'thread-1',
      version: 4,
      what: 'Protect session continuity',
      why: 'Reduce data loss during auth transitions',
      outOfScope: [],
      reason: 'operator',
      createdAt: '2026-06-16T00:00:00.000Z',
    })
    const upsert = vi.spyOn(session.requirementIntentLinkStore, 'upsert').mockResolvedValue()

    const result = await session.adoptIntentLedgerEntry({ entryId: 'task-1:run-a:obs-1' })

    expect(result).toEqual({ ok: true, promotedReqId: 'REQ-auth-2' })
    expect(upsert).toHaveBeenCalledWith(
      session.sidecarPaths,
      expect.objectContaining({
        reqId: 'REQ-auth-2',
        threadId: 'thread-1',
        decidedIntentVersion: 4,
        sourceTaskId: 'task-1',
      }),
    )
  })
})
