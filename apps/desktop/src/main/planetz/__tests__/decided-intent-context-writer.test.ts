import { DEFAULT_CONFIG } from '@planetz/shared'
import { describe, expect, it, vi } from 'vitest'
import type { TaskIntentContextSnapshotStore } from '../../sidecar/task-intent-context-snapshot-store.js'
import type { TaskThreadLinkStore } from '../../sidecar/task-thread-link-store.js'
import {
  DecidedIntentContextWriter,
  formatDecidedIntentContextMarkdown,
  formatEmptyDecidedIntentContextMarkdown,
} from '../decided-intent-context-writer.js'

const writeProjectFacetMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../../takt/facet-resolver.js', () => ({
  writeProjectFacet: writeProjectFacetMock,
}))

describe('decided-intent-context-writer', () => {
  it('formats decided intent markdown with version header', () => {
    const markdown = formatDecidedIntentContextMarkdown({
      id: 'thread-1#v2',
      threadId: 'thread-1',
      version: 2,
      what: 'Secure login',
      why: 'Reduce account takeover',
      outOfScope: ['SSO'],
      reason: 'operator',
      createdAt: '2026-06-16T00:00:00.000Z',
    })
    expect(markdown).toContain('Based on decided intent v2')
    expect(markdown).toContain('Secure login')
    expect(markdown).toContain('SSO')
  })

  it('formats empty decided intent placeholder', () => {
    expect(formatEmptyDecidedIntentContextMarkdown()).toContain('No decided intent saved')
  })

  it('regenerates facet and snapshot when thread and intent exist', async () => {
    writeProjectFacetMock.mockClear()
    const decidedIntentReadPort = {
      getCurrent: vi.fn(async () => ({
        id: 'thread-1#v4',
        threadId: 'thread-1',
        version: 4,
        what: 'Goal',
        why: 'Reason',
        outOfScope: [],
        reason: 'operator',
        createdAt: '2026-06-16T00:00:00.000Z',
      })),
    }
    const taskThreadLinkStore = {
      getThreadId: vi.fn(async () => 'thread-1'),
    } as unknown as TaskThreadLinkStore
    const upsert = vi.fn(async () => {})
    const snapshotStore = { upsert } as unknown as TaskIntentContextSnapshotStore
    const writer = new DecidedIntentContextWriter(
      decidedIntentReadPort,
      taskThreadLinkStore,
      snapshotStore,
    )
    const paths = { root: '/sidecar' } as never

    const ok = await writer.regenerateForTask('/workspace', DEFAULT_CONFIG, paths, 'task-9')

    expect(ok).toBe(true)
    expect(writeProjectFacetMock).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        taskId: 'task-9',
        threadId: 'thread-1',
        decidedIntentVersion: 4,
      }),
    )
  })

  it('no-ops when task is not linked to a thread', async () => {
    writeProjectFacetMock.mockClear()
    const taskThreadLinkStore = {
      getThreadId: vi.fn(async () => null),
    } as unknown as TaskThreadLinkStore
    const writer = new DecidedIntentContextWriter(
      { getCurrent: vi.fn(async () => null) },
      taskThreadLinkStore,
      { upsert: vi.fn(async () => {}) } as unknown as TaskIntentContextSnapshotStore,
    )

    const ok = await writer.regenerateForTask(
      '/workspace',
      DEFAULT_CONFIG,
      { root: '/sidecar' } as never,
      'task-9',
    )

    expect(ok).toBe(false)
    expect(writeProjectFacetMock).not.toHaveBeenCalled()
  })
})
