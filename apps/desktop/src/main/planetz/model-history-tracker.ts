import type { ExecutionProfile, TaskStatus, TaskViewModel } from '@planetz/shared'
import type { ModelHistoryStore } from '../sidecar/model-history-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

const TERMINAL_SUCCESS: TaskStatus = 'completed'

/** Tracks pending execution profiles and records model history on success. */
export class ModelHistoryTracker {
  private readonly pendingProfiles = new Map<string, ExecutionProfile>()
  private readonly previousStatuses = new Map<string, TaskStatus>()

  constructor(private readonly store: ModelHistoryStore) {}

  trackPendingTask(taskId: string, profile: ExecutionProfile): void {
    const provider = profile.provider?.trim()
    const model = profile.model?.trim()
    if (!provider || !model) return
    const effort = profile.effort?.trim()
    this.pendingProfiles.set(taskId, {
      provider,
      model,
      ...(effort ? { effort } : {}),
    })
  }

  async recordSuccess(paths: SidecarPaths, profile: ExecutionProfile): Promise<void> {
    const provider = profile.provider?.trim()
    const model = profile.model?.trim()
    if (!provider || !model) return
    await this.store.upsert(paths, { provider, model })
  }

  async onTasksUpdated(paths: SidecarPaths, tasks: TaskViewModel[]): Promise<void> {
    for (const task of tasks) {
      const prev = this.previousStatuses.get(task.id)
      const becameCompleted =
        task.status === TERMINAL_SUCCESS &&
        prev !== TERMINAL_SUCCESS &&
        (prev !== undefined || this.pendingProfiles.has(task.id))
      if (becameCompleted) {
        const profile = this.pendingProfiles.get(task.id)
        if (profile) {
          await this.recordSuccess(paths, profile)
          this.pendingProfiles.delete(task.id)
        }
      }
      this.previousStatuses.set(task.id, task.status)
    }

    const currentIds = new Set(tasks.map((t) => t.id))
    for (const taskId of this.pendingProfiles.keys()) {
      if (!currentIds.has(taskId)) {
        this.pendingProfiles.delete(taskId)
      }
    }
  }

  snapshotPendingProfiles(): ReadonlyMap<string, ExecutionProfile> {
    return new Map(this.pendingProfiles)
  }

  reset(): void {
    this.pendingProfiles.clear()
    this.previousStatuses.clear()
  }
}
