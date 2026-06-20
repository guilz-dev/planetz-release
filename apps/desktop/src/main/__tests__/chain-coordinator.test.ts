import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChainGroup, TaskViewModel } from '@planetz/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChainCoordinator } from '../session/chain-coordinator.js'
import { ChainFileStore } from '../sidecar/chain-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { closeAllSidecarSqlite } from '../storage/sqlite/connection.js'
import { mockSidecarPaths } from './mock-sidecar-paths.js'

const PATHS = { chainsPath: '/tmp/chains.json' } as SidecarPaths

const TASK_A: TaskViewModel = {
  id: 'a',
  title: 'A',
  status: 'completed',
  priority: 'normal',
  source: 'user',
  createdAt: '2026-05-24T00:00:00.000Z',
  updatedAt: '2026-05-24T00:00:00.000Z',
}

function makeCoordinator(fileGroups: ChainGroup[], saveSpy: ReturnType<typeof vi.fn>) {
  const fileStore = {
    load: vi.fn(async () =>
      fileGroups.map((g) => ({ ...g, edges: [...g.edges], taskIds: [...g.taskIds] })),
    ),
    save: saveSpy,
  }
  const coordinator = new ChainCoordinator(
    () => false,
    { list: () => [], syncWithTaskIds: () => {}, upsertEdge: () => ({ chainId: '' }) } as never,
    fileStore as never,
  )
  return coordinator
}

describe('ChainCoordinator.list', () => {
  it('does not persist when sync does not change chains', async () => {
    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a'],
        edges: [
          {
            fromTaskId: 'a',
            status: 'ready_to_create',
            planned: { title: 'Next', mode: 'branch_handoff' },
          },
        ],
      },
    ]
    const save = vi.fn(async () => {})
    const coordinator = makeCoordinator(groups, save)
    const tasksById = new Map([[TASK_A.id, TASK_A]])
    const taskIds = new Set([TASK_A.id])

    await coordinator.list(PATHS, taskIds, tasksById)
    expect(save).not.toHaveBeenCalled()

    await coordinator.list(PATHS, taskIds, tasksById)
    expect(save).not.toHaveBeenCalled()
  })

  it('projects edge status changes without writing during list', async () => {
    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a'],
        edges: [
          {
            fromTaskId: 'a',
            status: 'waiting_for_dependency',
            planned: { title: 'Next', mode: 'branch_handoff' },
          },
        ],
      },
    ]
    const save = vi.fn(async () => {})
    const coordinator = makeCoordinator(groups, save)
    const waiting = new Map([[TASK_A.id, { ...TASK_A, status: 'running' as const }]])
    const waitingResult = await coordinator.list(PATHS, new Set(['a']), waiting)
    expect(waitingResult[0]?.edges[0]?.status).toBe('waiting_for_dependency')

    const completed = new Map([[TASK_A.id, TASK_A]])
    const completedResult = await coordinator.list(PATHS, new Set(['a']), completed)
    expect(completedResult[0]?.edges[0]?.status).toBe('ready_to_create')
    expect(save).not.toHaveBeenCalled()
  })
})

describe('ChainCoordinator.reconcileAndPersist', () => {
  it('skips save when sync does not change chains', async () => {
    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a'],
        edges: [
          {
            fromTaskId: 'a',
            status: 'ready_to_create',
            planned: { title: 'Next', mode: 'branch_handoff' },
          },
        ],
      },
    ]
    const save = vi.fn(async () => {})
    const coordinator = makeCoordinator(groups, save)
    const tasksById = new Map([[TASK_A.id, TASK_A]])
    const taskIds = new Set([TASK_A.id])

    await coordinator.reconcileAndPersist(PATHS, taskIds, tasksById)
    expect(save).not.toHaveBeenCalled()

    await coordinator.reconcileAndPersist(PATHS, taskIds, tasksById)
    expect(save).not.toHaveBeenCalled()
  })

  it('persists when upstream completion changes edge status', async () => {
    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a'],
        edges: [
          {
            fromTaskId: 'a',
            status: 'waiting_for_dependency',
            planned: { title: 'Next', mode: 'branch_handoff' },
          },
        ],
      },
    ]
    const save = vi.fn(async () => {})
    const coordinator = makeCoordinator(groups, save)
    const waiting = new Map([[TASK_A.id, { ...TASK_A, status: 'running' as const }]])
    await coordinator.reconcileAndPersist(PATHS, new Set(['a']), waiting)
    expect(save).not.toHaveBeenCalled()

    const completed = new Map([[TASK_A.id, TASK_A]])
    const completedResult = await coordinator.reconcileAndPersist(PATHS, new Set(['a']), completed)
    expect(completedResult[0]?.edges[0]?.status).toBe('ready_to_create')
    expect(save).toHaveBeenCalledTimes(1)
  })
})

describe('ChainCoordinator with sqlite ChainFileStore', () => {
  let dir: string
  let paths: SidecarPaths
  const fileStore = new ChainFileStore()

  afterEach(async () => {
    closeAllSidecarSqlite()
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('persists edge status changes via sqlite chain store', async () => {
    dir = await mkdtemp(join(tmpdir(), 'chain-coordinator-sqlite-'))
    paths = mockSidecarPaths(dir)

    const groups: ChainGroup[] = [
      {
        id: 'chain-a',
        createdAt: '2026-05-24T00:00:00.000Z',
        taskIds: ['a'],
        edges: [
          {
            fromTaskId: 'a',
            status: 'waiting_for_dependency',
            planned: { title: 'Next', mode: 'branch_handoff' },
          },
        ],
      },
    ]
    await fileStore.save(paths, groups)

    const coordinator = new ChainCoordinator(
      () => false,
      { list: () => [], syncWithTaskIds: () => {}, upsertEdge: () => ({ chainId: '' }) } as never,
      fileStore,
    )

    const waiting = new Map([[TASK_A.id, { ...TASK_A, status: 'running' as const }]])
    await coordinator.reconcileAndPersist(paths, new Set(['a']), waiting)
    expect((await fileStore.load(paths))[0]?.edges[0]?.status).toBe('waiting_for_dependency')

    const completed = new Map([[TASK_A.id, TASK_A]])
    const result = await coordinator.reconcileAndPersist(paths, new Set(['a']), completed)
    expect(result[0]?.edges[0]?.status).toBe('ready_to_create')
    expect((await fileStore.load(paths))[0]?.edges[0]?.status).toBe('ready_to_create')
  })
})
