import type { EnqueueTaskInput } from '@planetz/shared'
import type { TaskPackageResult } from './task-package-writer.js'

/** v0.2 task operations (CLI or fallback writer). */
export interface TaktConnector {
  enqueueTask(input: EnqueueTaskInput, existingIds: Set<string>): Promise<TaskPackageResult>
  runTaskNow(input: EnqueueTaskInput): Promise<void>
  mergeResult(branch: string): Promise<string>
}
