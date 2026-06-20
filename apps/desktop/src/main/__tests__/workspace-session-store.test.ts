import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getPathMock = vi.fn<(name: string) => string>()

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => getPathMock(name),
  },
}))

import { WorkspaceSessionStore } from '../sidecar/workspace-session-store'

async function readSessionFile(root: string): Promise<{
  lastOpenedWorkspacePath?: string
  globalUiPreferences?: {
    theme?: string
    counterPackEnabled?: boolean
    language?: string
  }
}> {
  const raw = await readFile(join(root, 'workspace-session.json'), 'utf8')
  return JSON.parse(raw) as {
    lastOpenedWorkspacePath?: string
    globalUiPreferences?: {
      theme?: string
      counterPackEnabled?: boolean
      language?: string
    }
  }
}

describe('WorkspaceSessionStore', () => {
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workspace-session-store-'))
    getPathMock.mockReturnValue(root)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('deduplicates and keeps latest ordering', async () => {
    const store = new WorkspaceSessionStore()
    const wsA = join(root, 'a')
    const wsB = join(root, 'b')

    await store.markOpened(wsA)
    await store.markOpened(wsB)
    await store.markOpened(wsA)

    const recent = await store.listRecent()
    expect(recent.map((w) => w.path)).toEqual([wsA, wsB])
  })

  it('enforces recent workspace limit', async () => {
    const store = new WorkspaceSessionStore()

    for (let i = 0; i < 12; i += 1) {
      await store.markOpened(join(root, `ws-${i}`))
    }

    const recent = await store.listRecent()
    expect(recent).toHaveLength(10)
    expect(recent[0]?.path).toContain('ws-11')
    expect(recent[9]?.path).toContain('ws-2')
  })

  it('clears lastOpenedWorkspacePath when removing current last path', async () => {
    const store = new WorkspaceSessionStore()
    const wsA = join(root, 'a')
    const wsB = join(root, 'b')

    await store.markOpened(wsA)
    await store.markOpened(wsB)
    await store.remove(wsB)

    const file = await readSessionFile(root)
    expect(file.lastOpenedWorkspacePath).toBeUndefined()
  })

  it('persists global ui preferences independently from workspaces', async () => {
    const store = new WorkspaceSessionStore()

    const saved = await store.setGlobalUiPreferences({
      theme: 'operations',
      counterPackEnabled: true,
      language: 'ja',
    })

    expect(saved).toEqual({
      theme: 'operations',
      counterPackEnabled: true,
      language: 'ja',
    })

    const loaded = await store.getGlobalUiPreferences()
    expect(loaded).toEqual(saved)

    const file = await readSessionFile(root)
    expect(file.globalUiPreferences).toEqual(saved)
  })

  it('partial counterPack patch preserves existing global theme', async () => {
    const store = new WorkspaceSessionStore()

    await store.setGlobalUiPreferences({
      theme: 'nebula',
      counterPackEnabled: false,
      language: 'en',
    })
    const saved = await store.setGlobalUiPreferences({ counterPackEnabled: true })

    expect(saved).toEqual({
      theme: 'nebula',
      counterPackEnabled: true,
      language: 'en',
    })
  })

  it('initializeGlobalUiPreferences keeps existing global ui settings', async () => {
    const store = new WorkspaceSessionStore()

    await store.setGlobalUiPreferences({
      theme: 'supernova',
      counterPackEnabled: false,
      language: 'en',
    })
    const initialized = await store.initializeGlobalUiPreferences({
      theme: 'operations',
      counterPackEnabled: true,
      language: 'ja',
    })

    expect(initialized).toEqual({
      theme: 'supernova',
      counterPackEnabled: false,
      language: 'en',
    })
  })
})
