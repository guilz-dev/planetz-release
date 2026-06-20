import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AppSession } from '../app-session.js'
import { openSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

describe('AppSession SDD open snapshot cache', () => {
  let workspace = ''

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = ''
  })

  async function openSessionWithKiroSpec(): Promise<AppSession> {
    workspace = await mkdtemp(join(tmpdir(), 'planetz-sdd-cache-'))
    const specDir = join(workspace, '.kiro', 'specs', 'billing')
    await mkdir(specDir, { recursive: true })
    await writeFile(
      join(specDir, 'spec.json'),
      JSON.stringify({
        approvals: {
          requirements: { approved: false },
          design: { approved: false },
          tasks: { approved: false },
        },
      }),
      'utf8',
    )

    const paths = mockSidecarPaths(workspace)
    await openSidecarSqlite(paths)

    const session = new AppSession()
    session.workspacePath = workspace
    session.sidecarPaths = paths
    return session
  }

  it('reuses cache on get until invalidate', async () => {
    const session = await openSessionWithKiroSpec()
    const first = await session.rebuildSddOpenSnapshot()
    const second = await session.getSddOpenSnapshot()

    expect(second).toEqual(first)
    expect(second?.kiroPhase).toBe('requirements')
  })

  it('rebuilds on get when kiro specs change on disk', async () => {
    const session = await openSessionWithKiroSpec()
    const before = await session.rebuildSddOpenSnapshot()
    expect(before?.kiroPhase).toBe('requirements')

    await writeFile(
      join(workspace, '.kiro', 'specs', 'billing', 'spec.json'),
      JSON.stringify({
        approvals: {
          requirements: { approved: true },
          design: { approved: false },
          tasks: { approved: false },
        },
      }),
      'utf8',
    )

    const after = await session.getSddOpenSnapshot()
    expect(after?.kiroPhase).toBe('design')
  })

  it('rebuilds after invalidate', async () => {
    const session = await openSessionWithKiroSpec()
    await session.rebuildSddOpenSnapshot()
    session.invalidateSddOpenSnapshot()

    const snapshot = await session.getSddOpenSnapshot()
    expect(snapshot?.recommendedEntry).toBe('spec-studio')
  })
})
