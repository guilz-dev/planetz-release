import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODEL_HISTORY_MAX_ITEMS } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import {
  listUsageHistory,
  trimUsageHistory,
  upsertUsageHistory,
} from '../repositories/usage-history-repository.js'

describe('usage-history-repository', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('increments use_count on conflict for model history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'usage-history-model-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))
    const now = '2026-05-27T00:00:00.000Z'
    const later = '2026-05-27T01:00:00.000Z'

    upsertUsageHistory(db, 'model', { provider: 'cursor', value: 'auto', lastUsedAt: now })
    const row = upsertUsageHistory(db, 'model', {
      provider: 'cursor',
      value: 'auto',
      lastUsedAt: later,
    })

    expect(row.use_count).toBe(2)
    expect(row.last_used_at).toBe(later)
  })

  it('increments use_count on conflict for effort history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'usage-history-effort-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    upsertUsageHistory(db, 'effort', {
      provider: 'codex',
      value: 'high',
      lastUsedAt: '2026-05-27T00:00:00.000Z',
    })
    const row = upsertUsageHistory(db, 'effort', {
      provider: 'codex',
      value: 'high',
      lastUsedAt: '2026-05-27T01:00:00.000Z',
    })

    expect(row.use_count).toBe(2)
  })

  it('filters model history by provider', async () => {
    const root = await mkdtemp(join(tmpdir(), 'usage-history-filter-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    upsertUsageHistory(db, 'model', {
      provider: 'cursor',
      value: 'auto',
      lastUsedAt: '2026-05-27T00:00:00.000Z',
    })
    upsertUsageHistory(db, 'model', {
      provider: 'codex',
      value: 'gpt-5',
      lastUsedAt: '2026-05-27T01:00:00.000Z',
    })

    expect(listUsageHistory(db, 'model', 'cursor')).toHaveLength(1)
    expect(listUsageHistory(db, 'model', 'cursor')[0]?.value).toBe('auto')
  })

  it('trims model history to max items', async () => {
    const root = await mkdtemp(join(tmpdir(), 'usage-history-trim-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    for (let i = 0; i < MODEL_HISTORY_MAX_ITEMS + 3; i += 1) {
      upsertUsageHistory(db, 'model', {
        provider: 'cursor',
        value: `model-${i}`,
        lastUsedAt: `2026-05-27T00:00:${String(i).padStart(2, '0')}.000Z`,
      })
    }
    trimUsageHistory(db, 'model', MODEL_HISTORY_MAX_ITEMS)

    expect(listUsageHistory(db, 'model')).toHaveLength(MODEL_HISTORY_MAX_ITEMS)
  })
})
