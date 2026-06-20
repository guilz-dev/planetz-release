import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ChatComposerDraftStore } from '../sidecar/chat-composer-draft-store.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

describe('ChatComposerDraftStore (sqlite)', () => {
  const roots: string[] = []
  const store = new ChatComposerDraftStore()

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('persists and reloads unsent composer drafts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chat-composer-draft-store-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const snapshot = {
      draft: 'Still typing…',
      activeDraftId: 'draft_abc',
      selectedProvider: 'codex',
      selectedModel: 'gpt-5',
      items: [
        {
          id: 'draft_abc',
          title: 'Still typing…',
          workspacePath: '/repo/main',
          workspaceLabel: 'main',
          updatedAt: '2026-06-01T12:00:00.000Z',
          body: 'Still typing…',
        },
      ],
      updatedAt: '2026-06-01T12:00:00.000Z',
    }

    await store.save(paths, snapshot)
    const loaded = await store.load(paths)

    expect(loaded).toEqual(snapshot)
  })

  it('returns null when no draft is stored', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chat-composer-draft-empty-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)

    expect(await store.load(paths)).toBeNull()
  })
})
