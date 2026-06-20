import { SPEC_DRIVEN_WORKFLOW_NAME, type TaskViewModel } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INTENT_LEDGER_INGEST_MAX_ATTEMPTS,
  INTENT_LEDGER_INGEST_RETRY_INTERVAL_MS,
  type IntentLedgerIngestService,
  isRetriableIntentLedgerIngestSkip,
} from '../../planetz/intent-ledger-ingest-service.js'
import { IntentLedgerTracker } from '../../planetz/intent-ledger-tracker.js'
import type { RequirementIntentLinkIngestService } from '../../planetz/requirement-intent-link-ingest-service.js'
import type { IntentLedgerStore } from '../../sidecar/intent-ledger-store.js'
import type { RequirementIntentLinkStore } from '../../sidecar/requirement-intent-link-store.js'
import type { SidecarPaths } from '../../sidecar/sidecar-paths.js'

function task(id: string, status: TaskViewModel['status'], workflow?: string): TaskViewModel {
  return {
    id,
    title: id,
    priority: 'normal',
    status,
    source: 'takt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...(workflow ? { workflow } : {}),
  }
}

function createTracker(
  ingest: IntentLedgerIngestService['ingestCompletedTask'],
  existingEntryCount = 0,
  link?: {
    ingest: RequirementIntentLinkIngestService['ingestCompletedTask']
    existingLinkCount?: number
  },
): IntentLedgerTracker {
  const service = { ingestCompletedTask: ingest } as unknown as IntentLedgerIngestService
  const store = {
    countEntriesForTask: vi.fn(async () => existingEntryCount),
  } as unknown as IntentLedgerStore
  if (!link) {
    return new IntentLedgerTracker(service, store)
  }
  const linkService = {
    ingestCompletedTask: link.ingest,
  } as unknown as RequirementIntentLinkIngestService
  const linkStore = {
    countBySourceTaskId: vi.fn(async () => link.existingLinkCount ?? 0),
  } as unknown as RequirementIntentLinkStore
  return new IntentLedgerTracker(service, store, {
    service: linkService,
    store: linkStore,
  })
}

describe('IntentLedgerTracker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not backfill ingest for non-spec-driven tasks completed on first observation', async () => {
    const ingest = vi.fn(async () => ({ status: 'ok' as const, ingested: 1 }))
    const tracker = createTracker(ingest)
    const paths = { root: '/tmp' } as SidecarPaths

    await tracker.onTasksUpdated(paths, [task('old-done', 'completed')], () => ({
      taktRepoPath: '/repo',
      workspacePath: '/repo',
      config: {} as never,
      taskId: 'old-done',
      readWorkflowYaml: async () => null,
    }))

    expect(ingest).not.toHaveBeenCalled()
  })

  it('backfills ingest for spec-driven tasks missing from the ledger on first observation', async () => {
    const ingest = vi.fn(async () => ({ status: 'ok' as const, ingested: 1 }))
    const tracker = createTracker(ingest)
    const paths = { root: '/tmp' } as SidecarPaths

    await tracker.onTasksUpdated(
      paths,
      [task('old-done', 'completed', SPEC_DRIVEN_WORKFLOW_NAME)],
      () => ({
        taktRepoPath: '/repo',
        workspacePath: '/repo',
        config: {} as never,
        taskId: 'old-done',
        readWorkflowYaml: async () => null,
      }),
    )

    expect(ingest).toHaveBeenCalledTimes(1)
  })

  it('skips backfill when the ledger already has entries for the task', async () => {
    const ingest = vi.fn(async () => ({ status: 'ok' as const, ingested: 1 }))
    const tracker = createTracker(ingest, 2)
    const paths = { root: '/tmp' } as SidecarPaths

    await tracker.onTasksUpdated(
      paths,
      [task('old-done', 'completed', SPEC_DRIVEN_WORKFLOW_NAME)],
      () => ({
        taktRepoPath: '/repo',
        workspacePath: '/repo',
        config: {} as never,
        taskId: 'old-done',
        readWorkflowYaml: async () => null,
      }),
    )

    expect(ingest).not.toHaveBeenCalled()
  })

  it('ingests when a tracked task transitions to completed', async () => {
    const ingest = vi.fn(async () => ({ status: 'ok' as const, ingested: 2 }))
    const tracker = createTracker(ingest)
    const paths = { root: '/tmp' } as SidecarPaths
    const resolveInput = () => ({
      taktRepoPath: '/repo',
      workspacePath: '/repo',
      config: {} as never,
      taskId: 't1',
      readWorkflowYaml: async () => null,
    })

    await tracker.onTasksUpdated(paths, [task('t1', 'running')], resolveInput)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)

    expect(ingest).toHaveBeenCalledTimes(1)
  })

  it('retries ingest on skip until max attempts with interval spacing', async () => {
    vi.useFakeTimers()
    const ingest = vi.fn(async () => ({
      status: 'skip' as const,
      reason: 'missing_report' as const,
    }))
    const tracker = createTracker(ingest)
    const paths = { root: '/tmp' } as SidecarPaths
    const resolveInput = () => ({
      taktRepoPath: '/repo',
      workspacePath: '/repo',
      config: {} as never,
      taskId: 't1',
      readWorkflowYaml: async () => null,
    })

    await tracker.onTasksUpdated(paths, [task('t1', 'running')], resolveInput)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    expect(ingest).toHaveBeenCalledTimes(1)

    for (let i = 1; i < INTENT_LEDGER_INGEST_MAX_ATTEMPTS; i += 1) {
      await vi.advanceTimersByTimeAsync(INTENT_LEDGER_INGEST_RETRY_INTERVAL_MS)
      await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    }
    expect(ingest).toHaveBeenCalledTimes(INTENT_LEDGER_INGEST_MAX_ATTEMPTS)

    ingest.mockClear()
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('does not retry non-retriable skip reasons', async () => {
    expect(isRetriableIntentLedgerIngestSkip('path_denied')).toBe(false)
    expect(isRetriableIntentLedgerIngestSkip('invalid_report')).toBe(false)

    const ingest = vi.fn(async () => ({
      status: 'skip' as const,
      reason: 'invalid_report' as const,
    }))
    const tracker = createTracker(ingest)
    const paths = { root: '/tmp' } as SidecarPaths
    const resolveInput = () => ({
      taktRepoPath: '/repo',
      workspacePath: '/repo',
      config: {} as never,
      taskId: 't1',
      readWorkflowYaml: async () => null,
    })

    await tracker.onTasksUpdated(paths, [task('t1', 'running')], resolveInput)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)

    expect(ingest).toHaveBeenCalledTimes(1)
  })

  it('ingests requirement links when ledger ingest is still retrying', async () => {
    vi.useFakeTimers()
    const ingest = vi.fn(async () => ({
      status: 'skip' as const,
      reason: 'missing_report' as const,
    }))
    const linkIngest = vi.fn(async () => ({ status: 'ok' as const, ingested: 2 }))
    const tracker = createTracker(ingest, 0, { ingest: linkIngest })
    const paths = { root: '/tmp' } as SidecarPaths
    const resolveInput = () => ({
      taktRepoPath: '/repo',
      workspacePath: '/repo',
      config: {} as never,
      taskId: 't1',
      readWorkflowYaml: async () => null,
    })

    await tracker.onTasksUpdated(paths, [task('t1', 'running')], resolveInput)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)

    expect(linkIngest).toHaveBeenCalledTimes(1)
    expect(ingest).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTENT_LEDGER_INGEST_RETRY_INTERVAL_MS)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    expect(ingest).toHaveBeenCalledTimes(2)
    expect(linkIngest).toHaveBeenCalledTimes(1)
  })

  it('retries link ingest independently after ledger ingest succeeds', async () => {
    vi.useFakeTimers()
    const ingest = vi.fn(async () => ({ status: 'ok' as const, ingested: 0 }))
    const linkIngest = vi.fn(async () => ({
      status: 'skip' as const,
      reason: 'missing_report' as const,
    }))
    const tracker = createTracker(ingest, 0, { ingest: linkIngest })
    const paths = { root: '/tmp' } as SidecarPaths
    const resolveInput = () => ({
      taktRepoPath: '/repo',
      workspacePath: '/repo',
      config: {} as never,
      taskId: 't1',
      readWorkflowYaml: async () => null,
    })

    await tracker.onTasksUpdated(paths, [task('t1', 'running')], resolveInput)
    await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    expect(linkIngest).toHaveBeenCalledTimes(1)
    expect(ingest).toHaveBeenCalledTimes(1)

    for (let i = 1; i < INTENT_LEDGER_INGEST_MAX_ATTEMPTS; i += 1) {
      await vi.advanceTimersByTimeAsync(INTENT_LEDGER_INGEST_RETRY_INTERVAL_MS)
      await tracker.onTasksUpdated(paths, [task('t1', 'completed')], resolveInput)
    }
    expect(linkIngest).toHaveBeenCalledTimes(INTENT_LEDGER_INGEST_MAX_ATTEMPTS)
    expect(ingest).toHaveBeenCalledTimes(1)
  })

  it('skips link backfill when links already exist for the task', async () => {
    const ingest = vi.fn(async () => ({ status: 'ok' as const, ingested: 1 }))
    const linkIngest = vi.fn(async () => ({ status: 'ok' as const, ingested: 1 }))
    const tracker = createTracker(ingest, 2, { ingest: linkIngest, existingLinkCount: 3 })
    const paths = { root: '/tmp' } as SidecarPaths

    await tracker.onTasksUpdated(
      paths,
      [task('old-done', 'completed', SPEC_DRIVEN_WORKFLOW_NAME)],
      () => ({
        taktRepoPath: '/repo',
        workspacePath: '/repo',
        config: {} as never,
        taskId: 'old-done',
        readWorkflowYaml: async () => null,
      }),
    )

    expect(ingest).not.toHaveBeenCalled()
    expect(linkIngest).not.toHaveBeenCalled()
  })
})
