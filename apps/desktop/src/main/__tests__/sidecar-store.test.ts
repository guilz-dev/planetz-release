import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { SidecarStore } from '../sidecar/sidecar-store.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

const UI_CONFIG_KV_KEY = 'ui.config'

describe('SidecarStore config migration', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('creates defaults when config.json does not exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-store-defaults-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const store = new SidecarStore()

    const config = await store.loadConfig(paths)

    expect(config).toEqual(DEFAULT_CONFIG)
    const db = await openSidecarSqlite(paths)
    expect(readKvJson(db, UI_CONFIG_KV_KEY)).toEqual(DEFAULT_CONFIG)
  })

  it('removes legacy taktCliPath while preserving valid settings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-store-legacy-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const store = new SidecarStore()

    const db = await openSidecarSqlite(paths)
    writeKvJson(db, UI_CONFIG_KV_KEY, {
      taktCliPath: 'pnpm --dir /tmp/takt exec takt',
      watch: { autoStart: false },
      ui: { theme: 'operations', laneSpeed: 'fast' },
    })

    const config = await store.loadConfig(paths)

    expect(config.watch.autoStart).toBe(false)
    expect(config.ui.theme).toBe('operations')
    expect(config.ui.counterPackEnabled).toBe(false)
    expect(config.ui.laneSpeed).toBe('fast')

    const persisted = readKvJson(db, UI_CONFIG_KV_KEY) as Record<string, unknown>
    expect(persisted.taktCliPath).toBeUndefined()
  })

  it('migrates legacy ui.skin counter pack to theme plus counterPackEnabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-store-sushi-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const store = new SidecarStore()

    const db = await openSidecarSqlite(paths)
    writeKvJson(db, UI_CONFIG_KV_KEY, {
      ui: { skin: 'sushi', laneSpeed: 'normal' },
    })

    const config = await store.loadConfig(paths)

    expect(config.ui.theme).toBe('default')
    expect(config.ui.counterPackEnabled).toBe(true)

    const persisted = readKvJson(db, UI_CONFIG_KV_KEY) as { ui?: Record<string, unknown> }
    expect(persisted.ui?.skin).toBeUndefined()
    expect(persisted.ui?.theme).toBe('default')
    expect(persisted.ui?.counterPackEnabled).toBe(true)
  })

  it('migrates legacy ui.theme sushi-counter to default plus counterPackEnabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-store-sushi-counter-theme-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const store = new SidecarStore()

    const db = await openSidecarSqlite(paths)
    writeKvJson(db, UI_CONFIG_KV_KEY, {
      ui: { theme: 'sushi-counter', laneSpeed: 'normal' },
    })

    const config = await store.loadConfig(paths)

    expect(config.ui.theme).toBe('default')
    expect(config.ui.counterPackEnabled).toBe(true)

    const persisted = readKvJson(db, UI_CONFIG_KV_KEY) as { ui?: Record<string, unknown> }
    expect(persisted.ui?.theme).toBe('default')
    expect(persisted.ui?.counterPackEnabled).toBe(true)
  })

  it('persists canonical import prompt seen flag in ui-state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-store-ui-state-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const store = new SidecarStore()

    await store.saveUiState(paths, { canonicalImportPromptSeen: true })
    const loaded = await store.loadUiState(paths)

    expect(loaded.canonicalImportPromptSeen).toBe(true)
  })

  it('sanitizes provider-scoped model selections in ui-state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sidecar-store-provider-model-state-'))
    roots.push(root)
    const paths = mockSidecarPaths(root)
    const store = new SidecarStore()

    const db = await openSidecarSqlite(paths)
    writeKvJson(db, 'ui.state', {
      selectedTaskId: 'task-1',
      lastSelectedModelByProvider: {
        ' cursor ': ' composer-2.5 ',
        ollama: '',
      },
    })

    const loaded = await store.loadUiState(paths)

    expect(loaded.selectedTaskId).toBe('task-1')
    expect(loaded.lastSelectedModelByProvider).toEqual({ cursor: 'composer-2.5' })
  })
})
