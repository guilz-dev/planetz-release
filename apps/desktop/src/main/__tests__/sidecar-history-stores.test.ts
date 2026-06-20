import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROMPT_HISTORY_MAX_ITEMS } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversationStore } from '../sidecar/conversation-store.js'
import { PromptHistoryStore } from '../sidecar/prompt-history-store.js'
import { RetryContextStore } from '../sidecar/retry-context-store.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

describe('PromptHistoryStore (sqlite)', () => {
  const roots: string[] = []
  const store = new PromptHistoryStore()

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('appends submitted items ordered by created_at desc', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-history-store-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    await store.appendSubmitted(paths, {
      title: 'First',
      body: 'Body one',
      issueRef: 'guilz-dev/planetz#1',
      submittedTaskId: 'task-1',
    })
    await store.appendSubmitted(paths, {
      title: 'Second',
      body: 'Body two',
      submittedTaskId: 'task-2',
    })

    const items = await store.list(paths, 10)
    expect(items).toHaveLength(2)
    expect(items[0]?.title).toBe('Second')
    expect(items[1]?.title).toBe('First')
    expect(items[1]?.issueRef).toBe('guilz-dev/planetz#1')
  })

  it('deletes a prompt history item by id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-history-delete-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    const item = await store.appendSubmitted(paths, {
      title: 'Remove me',
      body: 'x',
      submittedTaskId: 'task-x',
    })
    await store.deleteItem(paths, item.id)

    expect(await store.list(paths)).toEqual([])
  })

  it('skips invalid prompt history rows on list', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-history-invalid-row-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    await store.appendSubmitted(paths, {
      title: 'Valid',
      body: 'ok',
      submittedTaskId: 'task-valid',
    })

    const db = await import('../storage/sqlite/connection.js').then((m) =>
      m.openSidecarSqlite(paths),
    )
    db.prepare(
      `
        INSERT INTO prompt_history (
          id, title, body, workflow, assigned_agent_id, submitted_task_id,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      '',
      'Bad',
      'body',
      null,
      null,
      null,
      'submitted',
      '2026-05-27T00:00:00.000Z',
      '2026-05-27T00:00:00.000Z',
    )

    const items = await store.list(paths, 10)
    expect(items).toHaveLength(1)
    expect(items[0]?.title).toBe('Valid')
  })

  it('caps stored items at PROMPT_HISTORY_MAX_ITEMS', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-history-cap-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    for (let i = 0; i < PROMPT_HISTORY_MAX_ITEMS + 5; i++) {
      await store.appendSubmitted(paths, {
        title: `Item ${i}`,
        body: 'body',
        submittedTaskId: `task-${i}`,
      })
    }

    const items = await store.list(paths, PROMPT_HISTORY_MAX_ITEMS + 10)
    expect(items).toHaveLength(PROMPT_HISTORY_MAX_ITEMS)
    expect(items[0]?.title).toBe(`Item ${PROMPT_HISTORY_MAX_ITEMS + 4}`)
  })
})

describe('ConversationStore (sqlite)', () => {
  const roots: string[] = []
  const store = new ConversationStore()

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('lists conversations for a task in created_at order', async () => {
    const root = await mkdtemp(join(tmpdir(), 'conversation-store-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    await store.append(paths, {
      taskId: 'task-a',
      role: 'user',
      kind: 'initial_order',
      body: 'first',
    })
    await store.append(paths, {
      taskId: 'task-a',
      role: 'user',
      kind: 'retry',
      body: 'second',
    })
    await store.append(paths, {
      taskId: 'task-b',
      role: 'user',
      kind: 'initial_order',
      body: 'other task',
    })

    const entries = await store.listForTask(paths, 'task-a')
    expect(entries).toHaveLength(2)
    expect(entries[0]?.body).toBe('first')
    expect(entries[1]?.body).toBe('second')
  })
})

describe('RetryContextStore (sqlite)', () => {
  const roots: string[] = []
  const store = new RetryContextStore()

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('appends retry context records', async () => {
    const root = await mkdtemp(join(tmpdir(), 'retry-context-store-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    await store.append(paths, {
      taskId: 'task-new',
      originTaskId: 'task-old',
      kind: 'retry',
      prompt: 'try again',
      createdAt: '2026-05-27T00:00:00.000Z',
    })

    const contexts = await store.list(paths)
    expect(contexts).toEqual([
      {
        taskId: 'task-new',
        originTaskId: 'task-old',
        kind: 'retry',
        prompt: 'try again',
        createdAt: '2026-05-27T00:00:00.000Z',
      },
    ])
  })
})
