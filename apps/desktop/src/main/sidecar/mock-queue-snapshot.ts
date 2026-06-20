import type { DatabaseSync } from 'node:sqlite'
import { mockTaskViewModelSchema, type TaskViewModel } from '@planetz/shared'
import { writeKvJson } from '../storage/sqlite/kv-store.js'
import { replaceAllMockTasks } from '../storage/sqlite/repositories/mock-tasks-repository.js'
import { MOCK_QUEUE_INITIALIZED_KV_KEY } from './sidecar-kv-keys.js'
import { parseSidecarRecordsStrict } from './sidecar-record-parse.js'

/** Persist mock queue rows and initialized flag. Caller owns transaction boundaries. */
export function writeMockQueueSnapshot(db: DatabaseSync, tasks: TaskViewModel[]): void {
  const validTasks = parseSidecarRecordsStrict(tasks, mockTaskViewModelSchema, 'mock queue task')
  replaceAllMockTasks(db, validTasks)
  writeKvJson(db, MOCK_QUEUE_INITIALIZED_KV_KEY, true)
}
