import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChainGroup } from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../../__tests__/mock-sidecar-paths.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../connection.js'
import {
  listChainGroupRows,
  replaceAllChainGroups,
} from '../repositories/chain-groups-repository.js'

const SAMPLE_CHAIN: ChainGroup = {
  id: 'chain-a',
  createdAt: '2026-05-27T00:00:00.000Z',
  taskIds: ['a'],
  edges: [
    {
      fromTaskId: 'a',
      status: 'ready_to_create',
      planned: { title: 'Next', mode: 'branch_handoff' },
    },
  ],
}

describe('chain-groups-repository', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('replaces all chain groups', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chain-groups-repo-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    replaceAllChainGroups(db, [
      {
        id: SAMPLE_CHAIN.id,
        createdAt: SAMPLE_CHAIN.createdAt,
        dataJson: JSON.stringify(SAMPLE_CHAIN),
      },
    ])
    expect(listChainGroupRows(db)).toHaveLength(1)

    replaceAllChainGroups(db, [])
    expect(listChainGroupRows(db)).toHaveLength(0)
  })

  it('lists chain groups ordered by created_at asc', async () => {
    const root = await mkdtemp(join(tmpdir(), 'chain-groups-order-'))
    roots.push(root)
    const db = await openSidecarSqlite(mockSidecarPaths(root))

    replaceAllChainGroups(db, [
      {
        id: 'chain-b',
        createdAt: '2026-05-27T01:00:00.000Z',
        dataJson: JSON.stringify({ ...SAMPLE_CHAIN, id: 'chain-b' }),
      },
      {
        id: 'chain-a',
        createdAt: '2026-05-27T00:00:00.000Z',
        dataJson: JSON.stringify(SAMPLE_CHAIN),
      },
    ])

    const rows = listChainGroupRows(db)
    expect(rows[0]?.id).toBe('chain-a')
    expect(rows[1]?.id).toBe('chain-b')
  })
})
