import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_CONFIG } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import type { IntentLedgerStore } from '../../sidecar/intent-ledger-store.js'
import { RequirementsPromotionService } from '../requirements-promotion-service.js'

const resolveTaskReportFileLocationMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/task-run-locations.js', () => ({
  resolveTaskReportFileLocation: resolveTaskReportFileLocationMock,
}))

describe('RequirementsPromotionService', () => {
  let reportsDir = ''
  let sidecarRoot = ''

  afterEach(async () => {
    resolveTaskReportFileLocationMock.mockReset()
    if (sidecarRoot) {
      await rm(sidecarRoot, { recursive: true, force: true })
      sidecarRoot = ''
      reportsDir = ''
    }
  })

  async function setupReports(requirementsContent = '# Requirements\n'): Promise<{
    paths: ReturnType<typeof mockSidecarPaths>
    entryId: string
  }> {
    sidecarRoot = await mkdtemp(join(tmpdir(), 'req-promotion-'))
    reportsDir = join(sidecarRoot, 'runs', 'run-a', 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(join(reportsDir, 'requirements.md'), requirementsContent, 'utf8')

    resolveTaskReportFileLocationMock.mockResolvedValue({
      status: 'found',
      runDirSlug: 'run-a',
      reportsDir,
    })

    const paths = mockSidecarPaths(sidecarRoot)
    return { paths, entryId: 'task-1:run-a:obs-1' }
  }

  it('appends adopted requirement block when entry and reports path exist', async () => {
    const { paths, entryId } = await setupReports('### REQ-auth-1\n\nExisting')
    const getById = vi.fn(async () => ({
      id: entryId,
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'obs-1',
      statement: 'Session switch discards drafts',
      authority: 'ratified' as const,
      scopeHint: null,
      sourceDoc: null,
      sourceRunDoc: null,
      createdAt: '2026-06-10T00:00:00.000Z',
      ratifiedAt: '2026-06-10T12:00:00.000Z',
      reversibility: null,
      satisfies: ['REQ-auth-1'],
      deviates: null,
      adjudicationKind: 'adopt' as const,
    }))
    const store = { getById } as unknown as IntentLedgerStore
    const service = new RequirementsPromotionService(store)

    const result = await service.promoteAdoptedEntry({
      paths,
      entryId,
      resolveTaskResult: {
        taskId: 'task-1',
        taktRepoPath: '/tmp/repo',
        workspacePath: sidecarRoot,
        config: DEFAULT_CONFIG,
        readWorkflowYaml: async () => null,
      },
    })

    expect(result.status).toBe('promoted')
    if (result.status !== 'promoted') return
    expect(result.reqId).toBe('REQ-auth-2')

    const markdown = await readFile(join(reportsDir, 'requirements.md'), 'utf8')
    expect(markdown).toContain('REQ-auth-2')
    expect(markdown).toContain('Session switch discards drafts')
    expect(markdown).toContain('adopted (intent ledger)')
  })

  it('skips when requirements report path cannot be resolved', async () => {
    const { paths, entryId } = await setupReports()
    resolveTaskReportFileLocationMock.mockResolvedValue({ status: 'no_run' })
    const getById = vi.fn(async () => ({
      id: entryId,
      taskId: 'task-1',
      sourceRun: 'run-a',
      decisionId: 'obs-1',
      statement: 'Drift',
      authority: 'ratified' as const,
      scopeHint: null,
      sourceDoc: null,
      sourceRunDoc: null,
      createdAt: '2026-06-10T00:00:00.000Z',
      ratifiedAt: '2026-06-10T12:00:00.000Z',
      reversibility: null,
      satisfies: null,
      deviates: null,
    }))
    const store = { getById } as unknown as IntentLedgerStore
    const service = new RequirementsPromotionService(store)

    const result = await service.promoteAdoptedEntry({
      paths,
      entryId,
      resolveTaskResult: {
        taskId: 'task-1',
        taktRepoPath: '/tmp/repo',
        workspacePath: sidecarRoot,
        config: DEFAULT_CONFIG,
        readWorkflowYaml: async () => null,
      },
    })

    expect(result).toEqual({ status: 'skipped', reason: 'requirements_no_run' })
  })
})
