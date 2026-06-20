import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  ESTABLISHED_DECISIONS_MAX_SUPPLY_ENTRIES,
  ESTABLISHED_DECISIONS_MAX_UNSCOPED_ENTRIES,
} from '@planetz/shared'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EstablishedDecisionsWriter,
  filterSupplyEntriesForTask,
  formatEstablishedDecisionsMarkdown,
  matchesTaskScope,
} from '../../planetz/established-decisions-writer.js'
import { IntentLedgerStore } from '../../sidecar/intent-ledger-store.js'
import { closeAllSidecarSqlite, openSidecarSqlite } from '../../storage/sqlite/connection.js'
import { upsertIntentLedgerEntry } from '../../storage/sqlite/repositories/intent-ledger-repository.js'
import { mockSidecarPaths } from '../mock-sidecar-paths.js'

const baseRecord = {
  sourceDoc: null,
  sourceRunDoc: null,
  createdAt: '2026-06-10T00:00:00.000Z',
  ratifiedAt: null,
  reversibility: null,
  satisfies: null,
  deviates: null,
}

describe('EstablishedDecisionsWriter', () => {
  const roots: string[] = []

  afterEach(async () => {
    closeAllSidecarSqlite()
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('formats ratified and unratified decisions in separate sections', () => {
    const markdown = formatEstablishedDecisionsMarkdown([
      {
        id: '1',
        taskId: 'task-1',
        sourceRun: 'run-a',
        decisionId: 'd1',
        statement: 'Ratified choice',
        authority: 'ratified',
        scopeHint: 'chat',
        ...baseRecord,
        ratifiedAt: '2026-06-10T01:00:00.000Z',
      },
      {
        id: '2',
        taskId: 'task-2',
        sourceRun: 'run-b',
        decisionId: 'd2',
        statement: 'Designed choice',
        authority: 'designed',
        scopeHint: null,
        ...baseRecord,
      },
    ])
    expect(markdown).toContain('## Ratified decisions')
    expect(markdown).toContain('## Documented decisions (unratified)')
    expect(markdown).toContain('Ratified choice')
    expect(markdown).toContain('Designed choice')
    expect(markdown).toContain('provisional')
  })

  it('includes trace fields in supply markdown when present', () => {
    const markdown = formatEstablishedDecisionsMarkdown([
      {
        id: '1',
        taskId: 'task-1',
        sourceRun: 'run-a',
        decisionId: 'd1',
        statement: 'Traced ratified choice',
        authority: 'ratified',
        scopeHint: null,
        ...baseRecord,
        sourceDoc: 'design.md §API',
        satisfies: ['REQ-auth-1'],
        deviates: ['DSN-api-2'],
        ratifiedAt: '2026-06-10T01:00:00.000Z',
      },
    ])
    expect(markdown).toContain('**Source**: design.md §API')
    expect(markdown).toContain('**Satisfies**: REQ-auth-1')
    expect(markdown).toContain('**Deviates**: DSN-api-2')
  })

  it('omits empty authority sections', () => {
    const markdown = formatEstablishedDecisionsMarkdown([
      {
        id: '1',
        taskId: 'task-1',
        sourceRun: 'run-a',
        decisionId: 'd1',
        statement: 'Only ratified',
        authority: 'ratified',
        scopeHint: null,
        ...baseRecord,
      },
    ])
    expect(markdown).toContain('## Ratified decisions')
    expect(markdown).not.toContain('## Documented decisions (unratified)')
  })

  it('filters by word-boundary scope hints and applies supply caps', () => {
    expect(
      matchesTaskScope(
        {
          id: '1',
          taskId: 'task-1',
          sourceRun: 'run-a',
          decisionId: 'd1',
          statement: 'Auth decision',
          authority: 'ratified',
          scopeHint: 'auth',
          ...baseRecord,
        },
        'Update author profile',
      ),
    ).toBe(false)

    const unscoped = Array.from(
      { length: ESTABLISHED_DECISIONS_MAX_UNSCOPED_ENTRIES + 2 },
      (_, i) => ({
        id: `u-${i}`,
        taskId: `task-${i}`,
        sourceRun: 'run-a',
        decisionId: `d-${i}`,
        statement: `Global ${i}`,
        authority: 'ratified' as const,
        scopeHint: null,
        ...baseRecord,
      }),
    )
    const filtered = filterSupplyEntriesForTask(unscoped, { title: 'Any task', body: '' })
    expect(filtered).toHaveLength(ESTABLISHED_DECISIONS_MAX_UNSCOPED_ENTRIES)

    const manyScoped = Array.from(
      { length: ESTABLISHED_DECISIONS_MAX_SUPPLY_ENTRIES + 5 },
      (_, i) => ({
        id: `s-${i}`,
        taskId: `task-${i}`,
        sourceRun: 'run-a',
        decisionId: `d-${i}`,
        statement: `Chat ${i}`,
        authority: 'ratified' as const,
        scopeHint: 'chat',
        ...baseRecord,
      }),
    )
    expect(
      filterSupplyEntriesForTask(manyScoped, { title: 'Fix chat composer', body: 'chat defaults' }),
    ).toHaveLength(ESTABLISHED_DECISIONS_MAX_SUPPLY_ENTRIES)

    expect(
      filterSupplyEntriesForTask(
        [
          {
            id: '1',
            taskId: 'task-1',
            sourceRun: 'run-a',
            decisionId: 'd1',
            statement: 'Chat scope decision',
            authority: 'ratified',
            scopeHint: 'chat',
            ...baseRecord,
          },
          {
            id: '2',
            taskId: 'task-2',
            sourceRun: 'run-b',
            decisionId: 'd2',
            statement: 'Billing scope decision',
            authority: 'ratified',
            scopeHint: 'billing',
            ...baseRecord,
          },
        ],
        { title: 'Fix chat composer', body: 'Adjust chat provider defaults' },
      ),
    ).toHaveLength(1)
  })

  it('writes established-decisions facet under sidecar facets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'established-decisions-'))
    roots.push(root)
    const workspacePath = join(root, 'workspace')
    const sidecarRoot = join(workspacePath, '.planetz', 'orbit')
    await mkdir(sidecarRoot, { recursive: true })
    const paths = mockSidecarPaths(sidecarRoot)
    const db = await openSidecarSqlite(paths)
    upsertIntentLedgerEntry(db, {
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'd1',
      statement: 'Persist drafts on session switch',
      authority: 'ratified',
      scopeHint: 'chat',
      createdAt: '2026-06-10T00:00:00.000Z',
    })

    const writer = new EstablishedDecisionsWriter(new IntentLedgerStore())
    await writer.regenerateForTask(workspacePath, DEFAULT_CONFIG, paths, {
      title: 'Chat polish',
      body: 'Update chat session behavior',
    })

    const facetPath = join(sidecarRoot, 'facets', 'knowledge', 'established-decisions.md')
    const content = await readFile(facetPath, 'utf8')
    expect(content).toContain('Persist drafts on session switch')
    expect(content).toContain('## Ratified decisions')
  })
})
