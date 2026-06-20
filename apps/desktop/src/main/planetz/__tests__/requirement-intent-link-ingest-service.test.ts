import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INTENT_LINKS_REPORT_FILE } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockSidecarPaths } from '../../__tests__/mock-sidecar-paths.js'
import type { RequirementIntentLinkStore } from '../../sidecar/requirement-intent-link-store.js'
import type { TaskIntentContextSnapshotStore } from '../../sidecar/task-intent-context-snapshot-store.js'
import { RequirementIntentLinkIngestService } from '../requirement-intent-link-ingest-service.js'

const resolveTaskReportFileLocationMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/task-run-locations.js', () => ({
  resolveTaskReportFileLocation: resolveTaskReportFileLocationMock,
}))

describe('RequirementIntentLinkIngestService', () => {
  let sidecarRoot = ''
  let reportsDir = ''

  afterEach(async () => {
    resolveTaskReportFileLocationMock.mockReset()
    if (sidecarRoot) {
      await rm(sidecarRoot, { recursive: true, force: true })
      sidecarRoot = ''
      reportsDir = ''
    }
  })

  async function setupReports(options?: {
    linksJson?: string
    requirementsMarkdown?: string
  }): Promise<ReturnType<typeof mockSidecarPaths>> {
    sidecarRoot = await mkdtemp(join(tmpdir(), 'req-link-ingest-'))
    reportsDir = join(sidecarRoot, 'runs', 'run-a', 'reports')
    await mkdir(reportsDir, { recursive: true })
    await writeFile(
      join(reportsDir, 'requirements.md'),
      options?.requirementsMarkdown ??
        [
          '# Requirements',
          '',
          '## Functional requirements (with acceptance criteria)',
          '',
          '- `REQ-auth-1` WHEN the user signs in THEN the app starts a session.',
          '- `REQ-auth-2` WHEN the user signs out THEN the app clears the session.',
        ].join('\n'),
      'utf8',
    )
    await writeFile(
      join(reportsDir, INTENT_LINKS_REPORT_FILE),
      options?.linksJson ??
        JSON.stringify({
          version: 1,
          links: [
            { reqId: 'REQ-auth-1', rationale: 'Covers login from decided intent' },
            { reqId: 'REQ-auth-2', rationale: 'Covers logout from decided intent' },
            { reqId: 'REQ-unknown-9', rationale: 'Not in requirements.md' },
          ],
        }),
      'utf8',
    )

    resolveTaskReportFileLocationMock.mockImplementation(async (_input, fileName: string) => {
      if (fileName === INTENT_LINKS_REPORT_FILE || fileName === 'requirements.md') {
        return { status: 'found', runDirSlug: 'run-a', reportsDir }
      }
      return { status: 'missing_report', runDirSlug: 'run-a' }
    })

    return mockSidecarPaths(sidecarRoot)
  }

  function resolveInput(taskId = 'task-1') {
    return {
      taskId,
      taktRepoPath: '/tmp/repo',
      workspacePath: sidecarRoot,
      config: {} as never,
      readWorkflowYaml: async () => null,
    }
  }

  it('skips when run context snapshot is missing', async () => {
    const paths = await setupReports()
    const snapshotStore = {
      get: vi.fn(async () => null),
    } as unknown as TaskIntentContextSnapshotStore
    const linkStore = { upsert: vi.fn(async () => {}) } as unknown as RequirementIntentLinkStore
    const service = new RequirementIntentLinkIngestService(linkStore, snapshotStore)

    const outcome = await service.ingestCompletedTask(paths, resolveInput())

    expect(outcome).toEqual({ status: 'skip', reason: 'no_context_snapshot' })
    expect(linkStore.upsert).not.toHaveBeenCalled()
  })

  it('upserts links for reqs present in requirements.md using snapshot thread and version', async () => {
    const paths = await setupReports()
    const upsert = vi.fn(async () => {})
    const snapshotStore = {
      get: vi.fn(async () => ({
        taskId: 'task-1',
        threadId: 'thread-1',
        decidedIntentVersion: 3,
        capturedAt: '2026-06-16T00:00:00.000Z',
      })),
    } as unknown as TaskIntentContextSnapshotStore
    const linkStore = { upsert } as unknown as RequirementIntentLinkStore
    const service = new RequirementIntentLinkIngestService(linkStore, snapshotStore)

    const outcome = await service.ingestCompletedTask(paths, resolveInput())

    expect(outcome).toEqual({ status: 'ok', ingested: 2 })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        reqId: 'REQ-auth-1',
        threadId: 'thread-1',
        decidedIntentVersion: 3,
        sourceTaskId: 'task-1',
      }),
    )
  })

  it('skips invalid intent-links.json', async () => {
    const paths = await setupReports({ linksJson: '{ not json' })
    const snapshotStore = {
      get: vi.fn(async () => ({
        taskId: 'task-1',
        threadId: 'thread-1',
        decidedIntentVersion: 1,
        capturedAt: '2026-06-16T00:00:00.000Z',
      })),
    } as unknown as TaskIntentContextSnapshotStore
    const linkStore = { upsert: vi.fn(async () => {}) } as unknown as RequirementIntentLinkStore
    const service = new RequirementIntentLinkIngestService(linkStore, snapshotStore)

    const outcome = await service.ingestCompletedTask(paths, resolveInput())

    expect(outcome).toEqual({ status: 'skip', reason: 'invalid_report' })
    expect(linkStore.upsert).not.toHaveBeenCalled()
  })
})
