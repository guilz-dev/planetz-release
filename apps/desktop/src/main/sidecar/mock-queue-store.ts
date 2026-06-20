import { mockTaskViewModelSchema, type TaskViewModel } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson } from '../storage/sqlite/kv-store.js'
import { listMockTaskRows } from '../storage/sqlite/repositories/mock-tasks-repository.js'
import { runSidecarTransaction } from '../storage/sqlite/transaction.js'
import { writeMockQueueSnapshot } from './mock-queue-snapshot.js'
import { parseSidecarJson } from './sidecar-json-parse.js'
import { MOCK_QUEUE_INITIALIZED_KV_KEY } from './sidecar-kv-keys.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecords } from './sidecar-record-parse.js'

function isMockQueueInitialized(db: Awaited<ReturnType<typeof getSidecarSqlite>>): boolean {
  return readKvJson(db, MOCK_QUEUE_INITIALIZED_KV_KEY) === true
}

function rowToTask(row: { data_json: string; id?: string }): TaskViewModel | null {
  return parseSidecarJson<TaskViewModel>(row.data_json, `mock task ${row.id ?? '(unknown)'}`)
}

export class MockQueueStore {
  async load(paths: SidecarPaths): Promise<TaskViewModel[] | null> {
    const db = await getSidecarSqlite(paths)
    const rows = listMockTaskRows(db)
    if (rows.length === 0) {
      return isMockQueueInitialized(db) ? [] : null
    }
    const tasks = parseSidecarRecords(
      rows.map(rowToTask).filter((task): task is TaskViewModel => task !== null),
      mockTaskViewModelSchema,
      'mock task',
    )
    return tasks
  }

  async save(paths: SidecarPaths, tasks: TaskViewModel[]): Promise<void> {
    const db = await getSidecarSqlite(paths)
    runSidecarTransaction(db, () => {
      writeMockQueueSnapshot(db, tasks)
    })
  }
}
