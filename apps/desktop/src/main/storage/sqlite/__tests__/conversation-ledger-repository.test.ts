import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import {
  appendThreadTurnsTransactional,
  archiveThread,
  clearActiveSessionId,
  deleteThread,
  getThreadWithTurns,
  insertConversationThread,
  insertConversationTurn,
  listOpenThreads,
  rebindOpenThreadSession,
  searchOpenThreads,
} from '../repositories/conversation-ledger-repository.js'

const WORKSPACE = '/tmp/planetz-conv-ledger-ws'
const TS_A = '2026-06-01T10:00:00.000Z'
const TS_B = '2026-06-01T11:00:00.000Z'

describe('conversation-ledger-repository', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  async function openDb() {
    const root = await mkdtemp(join(tmpdir(), 'conv-ledger-'))
    roots.push(root)
    return openSidecarSqlite(mockSidecarPaths(root))
  }

  it('defaults new threads to open status', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_open',
      workspacePath: WORKSPACE,
      title: 'Untitled',
      updatedAt: TS_A,
    })

    const row = db
      .prepare('SELECT status FROM conversation_threads WHERE thread_id = ?')
      .get('thr_open') as { status: string }
    expect(row.status).toBe('open')
  })

  it('ignores invalid session_policy values when listing', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_bad_policy',
      workspacePath: WORKSPACE,
      title: 'Bad policy',
      updatedAt: TS_A,
      sessionPolicy: 'not-a-real-policy' as never,
    })

    const threads = listOpenThreads(db, WORKSPACE)
    expect(threads.find((thread) => thread.threadId === 'thr_bad_policy')?.sessionPolicy).toBe(
      undefined,
    )
  })

  it('rebinds active session and sessionPolicy on an open thread', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_rebind',
      workspacePath: WORKSPACE,
      title: 'Before',
      updatedAt: TS_A,
      activeSessionId: 'composer_old',
      sessionPolicy: 'planetz-chat-investigate',
    })

    const rebound = rebindOpenThreadSession(db, {
      threadId: 'thr_rebind',
      workspacePath: WORKSPACE,
      activeSessionId: 'composer_new',
      sessionPolicy: 'planetz-chat-spec',
      updatedAt: TS_B,
    })
    expect(rebound).toBe(true)

    const threads = listOpenThreads(db, WORKSPACE)
    expect(threads[0]).toMatchObject({
      threadId: 'thr_rebind',
      activeSessionId: 'composer_new',
      sessionPolicy: 'planetz-chat-spec',
    })
  })

  it('persists sessionPolicy on thread insert and list', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_policy',
      workspacePath: WORKSPACE,
      title: 'Investigate',
      updatedAt: TS_A,
      sessionPolicy: 'planetz-chat-investigate',
    })

    const threads = listOpenThreads(db, WORKSPACE)
    expect(threads[0]?.sessionPolicy).toBe('planetz-chat-investigate')
  })

  it('rejects invalid status on insert', async () => {
    const db = await openDb()
    expect(() =>
      db
        .prepare(
          `
            INSERT INTO conversation_threads (
              thread_id, workspace_path, title, status, updated_at
            )
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run('thr_bad', WORKSPACE, 'x', 'closed', TS_A),
    ).toThrow()
  })

  it('excludes archived threads from list and search but get still finds them', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_arch',
      workspacePath: WORKSPACE,
      title: 'Auth flow',
      updatedAt: TS_A,
    })
    insertConversationTurn(db, {
      turnId: 'turn_1',
      threadId: 'thr_arch',
      turnIndex: 0,
      role: 'user',
      content: 'Discuss AUTH tokens',
      createdAt: TS_A,
    })
    archiveThread(db, 'thr_arch', WORKSPACE)

    expect(listOpenThreads(db, WORKSPACE)).toHaveLength(0)
    expect(searchOpenThreads(db, 'auth', WORKSPACE)).toHaveLength(0)

    const got = getThreadWithTurns(db, 'thr_arch', WORKSPACE)
    expect(got?.thread.title).toBe('Auth flow')
    expect(got?.turns).toHaveLength(1)
  })

  it('search is case-insensitive on title and turn content', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_search',
      workspacePath: WORKSPACE,
      title: 'OAuth setup',
      updatedAt: TS_B,
    })
    insertConversationTurn(db, {
      turnId: 'turn_s1',
      threadId: 'thr_search',
      turnIndex: 0,
      role: 'assistant',
      content: 'Use bearer tokens',
      createdAt: TS_B,
    })

    const byTitle = searchOpenThreads(db, 'oauth', WORKSPACE)
    expect(byTitle.map((t) => t.threadId)).toEqual(['thr_search'])

    const byTurn = searchOpenThreads(db, 'BEARER', WORKSPACE)
    expect(byTurn.map((t) => t.threadId)).toEqual(['thr_search'])
  })

  it('deleteThread cascades turns', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_del',
      workspacePath: WORKSPACE,
      title: 'To delete',
      updatedAt: TS_A,
    })
    insertConversationTurn(db, {
      turnId: 'turn_del',
      threadId: 'thr_del',
      turnIndex: 0,
      role: 'user',
      content: 'bye',
      createdAt: TS_A,
    })

    expect(deleteThread(db, 'thr_del', WORKSPACE)).toBe(true)
    expect(getThreadWithTurns(db, 'thr_del', WORKSPACE)).toBeNull()

    const turnCount = db
      .prepare('SELECT COUNT(*) AS c FROM conversation_turns WHERE thread_id = ?')
      .get('thr_del') as { c: number }
    expect(turnCount.c).toBe(0)
  })

  it('rejects duplicate turn_index for the same thread', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_dup',
      workspacePath: WORKSPACE,
      title: 'Dup turns',
      updatedAt: TS_A,
    })
    insertConversationTurn(db, {
      turnId: 'turn_a',
      threadId: 'thr_dup',
      turnIndex: 0,
      role: 'user',
      content: 'first',
      createdAt: TS_A,
    })
    expect(() =>
      insertConversationTurn(db, {
        turnId: 'turn_b',
        threadId: 'thr_dup',
        turnIndex: 0,
        role: 'assistant',
        content: 'second',
        createdAt: TS_B,
      }),
    ).toThrow()
  })

  it('maps hasActiveSession from active_session_id', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_active',
      workspacePath: WORKSPACE,
      title: 'Live',
      updatedAt: TS_A,
      activeSessionId: 'sess_1',
    })
    insertConversationThread(db, {
      threadId: 'thr_idle',
      workspacePath: WORKSPACE,
      title: 'Idle',
      updatedAt: TS_B,
    })

    const listed = listOpenThreads(db, WORKSPACE)
    const active = listed.find((t) => t.threadId === 'thr_active')
    const idle = listed.find((t) => t.threadId === 'thr_idle')
    expect(active?.hasActiveSession).toBe(true)
    expect(active?.activeSessionId).toBe('sess_1')
    expect(idle?.hasActiveSession).toBe(false)
    expect(idle?.activeSessionId).toBeUndefined()
  })

  it('appends turns transactionally and updates title from first user message', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_append',
      workspacePath: WORKSPACE,
      title: 'Untitled conversation',
      updatedAt: TS_A,
      activeSessionId: 'sess_append',
    })
    appendThreadTurnsTransactional(db, {
      threadId: 'thr_append',
      workspacePath: WORKSPACE,
      updatedAt: TS_B,
      titleFromFirstUserMessage: 'First user line',
      turns: [
        {
          turnId: 'turn_u',
          role: 'user',
          content: 'Hello ledger',
          createdAt: TS_B,
        },
        {
          turnId: 'turn_a',
          role: 'assistant',
          content: 'Hi there',
          createdAt: TS_B,
        },
      ],
    })
    const loaded = getThreadWithTurns(db, 'thr_append', WORKSPACE)
    expect(loaded?.thread.title).toBe('First user line')
    expect(loaded?.turns).toHaveLength(2)
    expect(loaded?.turns[0]?.content).toBe('Hello ledger')
  })

  it('clears active_session_id on finalize path', async () => {
    const db = await openDb()
    insertConversationThread(db, {
      threadId: 'thr_clear',
      workspacePath: WORKSPACE,
      title: 'Clear me',
      updatedAt: TS_A,
      activeSessionId: 'sess_clear',
    })
    expect(clearActiveSessionId(db, 'thr_clear', WORKSPACE, TS_B)).toBe(true)
    const row = getThreadWithTurns(db, 'thr_clear', WORKSPACE)
    expect(row?.thread.hasActiveSession).toBe(false)
  })
})
