import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import { IntentLedgerStore } from '../../sidecar/intent-ledger-store.js'
import { openSidecarSqlite } from '../../storage/sqlite/connection.js'
import { KiroSpecStore } from '../kiro-spec-store.js'
import { buildSddOpenSnapshot } from '../sdd-open-snapshot-service.js'
import { SpecApprovalIngestService } from '../spec-approval-ingest-service.js'

describe('buildSddOpenSnapshot', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('builds snapshot with kiro phase and ledger counts', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sdd-open-'))
    const specDir = join(workspace, '.kiro', 'specs', 'billing')
    await mkdir(specDir, { recursive: true })
    await writeFile(
      join(specDir, 'spec.json'),
      JSON.stringify({
        approvals: {
          requirements: { approved: true },
          design: { approved: false },
        },
      }),
      'utf8',
    )

    const paths = mockSidecarPaths(workspace)
    await openSidecarSqlite(paths)
    const intentLedgerStore = new IntentLedgerStore()
    const kiroSpecStore = new KiroSpecStore()
    const specApprovalIngest = new SpecApprovalIngestService(intentLedgerStore, kiroSpecStore)

    const { snapshot } = await buildSddOpenSnapshot({
      workspacePath: workspace,
      sidecarPaths: paths,
      intentLedgerStore,
      kiroSpecStore,
      specApprovalIngest,
    })

    expect(snapshot.kiroSpecCount).toBe(1)
    expect(snapshot.recommendedEntry).toBe('spec-studio')
    expect(snapshot.kiroPhase).toBe('design')
    expect(snapshot.featuresNeedingApproval).toEqual([
      { featureId: 'billing', phase: 'design' },
      { featureId: 'billing', phase: 'tasks' },
    ])
  })
})

describe('SpecApprovalIngestService', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  it('records approval transitions after initial seed', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-spec-approval-'))
    const specDir = join(workspace, '.kiro', 'specs', 'auth')
    await mkdir(specDir, { recursive: true })
    const specPath = join(specDir, 'spec.json')
    await writeFile(
      specPath,
      JSON.stringify({ approvals: { requirements: { approved: false } } }),
      'utf8',
    )

    const paths = mockSidecarPaths(workspace)
    await openSidecarSqlite(paths)
    const intentLedgerStore = new IntentLedgerStore()
    const service = new SpecApprovalIngestService(intentLedgerStore, new KiroSpecStore())

    expect(await service.sync(workspace, paths)).toBe(0)

    await writeFile(
      specPath,
      JSON.stringify({ approvals: { requirements: { approved: true } } }),
      'utf8',
    )
    expect(await service.sync(workspace, paths)).toBe(1)

    const entries = await intentLedgerStore.listByTaskId(paths, 'kiro:auth')
    expect(entries.some((entry) => entry.decisionId === 'approval:requirements')).toBe(true)
  })
})
