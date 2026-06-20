import { SPEC_DRIVEN_WORKFLOW_NAME, type TaskStatus, type TaskViewModel } from '@planetz/shared'
import type { ResolveTaskResultInput } from '../lib/task-result-input.js'
import type { IntentLedgerStore } from '../sidecar/intent-ledger-store.js'
import type { RequirementIntentLinkStore } from '../sidecar/requirement-intent-link-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import {
  type IntentLedgerIngestService,
  type IntentLedgerIngestSkipReason,
  isRetriableIntentLedgerIngestSkip,
  TASK_REPORT_INGEST_MAX_ATTEMPTS,
  TASK_REPORT_INGEST_RETRY_INTERVAL_MS,
} from './intent-ledger-ingest-service.js'
import {
  isRetriableRequirementIntentLinkIngestSkip,
  type RequirementIntentLinkIngestService,
  type RequirementIntentLinkIngestSkipReason,
} from './requirement-intent-link-ingest-service.js'

const TERMINAL_SUCCESS: TaskStatus = 'completed'

interface PendingChannel {
  attempts: number
  nextRetryAt: number
}

interface PendingIngest {
  ledger?: PendingChannel
  link?: PendingChannel
}

type IngestScheduleKind = 'transition' | 'backfill'

type ChannelRunOutcome = { status: 'ok' } | { status: 'skip'; reason: string }

type ChannelAttemptResult = 'ok' | 'settled' | 'retry'

type IngestTaskOutcome = { status: 'ok' } | { status: 'skip'; reason: string }

function toChannelRunOutcome(outcome: IngestTaskOutcome): ChannelRunOutcome {
  if (outcome.status === 'ok') return { status: 'ok' }
  return { status: 'skip', reason: outcome.reason }
}

export type IntentLedgerTrackerLinkDeps = {
  service: RequirementIntentLinkIngestService
  store: Pick<RequirementIntentLinkStore, 'countBySourceTaskId'>
}

function resolveIngestSchedule(
  task: TaskViewModel,
  prev: TaskStatus | undefined,
  alreadyPending: boolean,
): IngestScheduleKind | null {
  const becameCompleted =
    task.status === TERMINAL_SUCCESS && prev !== TERMINAL_SUCCESS && prev !== undefined
  if (becameCompleted) return 'transition'

  if (
    prev === undefined &&
    task.status === TERMINAL_SUCCESS &&
    task.workflow === SPEC_DRIVEN_WORKFLOW_NAME &&
    !alreadyPending
  ) {
    return 'backfill'
  }

  return null
}

function freshChannel(): PendingChannel {
  return { attempts: 0, nextRetryAt: 0 }
}

function hasPendingChannels(pending: PendingIngest): boolean {
  return pending.ledger !== undefined || pending.link !== undefined
}

function isChannelReady(channel: PendingChannel | undefined): channel is PendingChannel {
  return channel !== undefined && Date.now() >= channel.nextRetryAt
}

/** Tracks task completion and ingests run reports into intent_ledger and requirement links. */
export class IntentLedgerTracker {
  private readonly previousStatuses = new Map<string, TaskStatus>()
  private readonly pendingIngest = new Map<string, PendingIngest>()

  constructor(
    private readonly ingestService: IntentLedgerIngestService,
    private readonly store: IntentLedgerStore,
    private readonly linkDeps?: IntentLedgerTrackerLinkDeps,
    private readonly onIngestSuccess?: () => void,
  ) {}

  async onTasksUpdated(
    paths: SidecarPaths,
    tasks: TaskViewModel[],
    resolveInput: (taskId: string) => ResolveTaskResultInput | null,
  ): Promise<void> {
    for (const task of tasks) {
      const prev = this.previousStatuses.get(task.id)
      const schedule = resolveIngestSchedule(task, prev, this.pendingIngest.has(task.id))

      if (schedule === 'transition') {
        const pending: PendingIngest = { ledger: freshChannel() }
        if (this.linkDeps) pending.link = freshChannel()
        this.pendingIngest.set(task.id, pending)
      } else if (schedule === 'backfill') {
        const pending: PendingIngest = {}
        const existingCount = await this.store.countEntriesForTask(paths, task.id)
        if (existingCount === 0) {
          pending.ledger = freshChannel()
        }
        if (this.linkDeps) {
          const linkCount = await this.linkDeps.store.countBySourceTaskId(paths, task.id)
          if (linkCount === 0) {
            pending.link = freshChannel()
          }
        }
        if (hasPendingChannels(pending)) {
          this.pendingIngest.set(task.id, pending)
        }
      }

      if (task.status === TERMINAL_SUCCESS && this.pendingIngest.has(task.id)) {
        await this.tryIngest(paths, task.id, resolveInput)
      }

      this.previousStatuses.set(task.id, task.status)
    }

    const currentIds = new Set(tasks.map((t) => t.id))
    for (const taskId of this.pendingIngest.keys()) {
      if (!currentIds.has(taskId)) {
        this.pendingIngest.delete(taskId)
      }
    }
  }

  private async tryIngest(
    paths: SidecarPaths,
    taskId: string,
    resolveInput: (taskId: string) => ResolveTaskResultInput | null,
  ): Promise<void> {
    const pending = this.pendingIngest.get(taskId)
    if (!pending || !hasPendingChannels(pending)) return

    const input = resolveInput(taskId)
    if (!input) {
      this.pendingIngest.delete(taskId)
      return
    }

    let anySuccess = false

    if (isChannelReady(pending.ledger)) {
      const result = await this.runChannel(
        pending.ledger,
        async () => toChannelRunOutcome(await this.ingestService.ingestCompletedTask(paths, input)),
        (reason) => isRetriableIntentLedgerIngestSkip(reason as IntentLedgerIngestSkipReason),
        'intent ledger ingest',
        taskId,
      )
      if (result === 'ok') anySuccess = true
      if (result === 'ok' || result === 'settled') pending.ledger = undefined
    }

    if (this.linkDeps && isChannelReady(pending.link)) {
      const linkDeps = this.linkDeps
      const result = await this.runChannel(
        pending.link,
        async () => toChannelRunOutcome(await linkDeps.service.ingestCompletedTask(paths, input)),
        (reason) =>
          isRetriableRequirementIntentLinkIngestSkip(
            reason as RequirementIntentLinkIngestSkipReason,
          ),
        'requirement intent link ingest',
        taskId,
      )
      if (result === 'ok') anySuccess = true
      if (result === 'ok' || result === 'settled') pending.link = undefined
    }

    if (anySuccess) {
      this.onIngestSuccess?.()
    }

    if (!hasPendingChannels(pending)) {
      this.pendingIngest.delete(taskId)
    }
  }

  private async runChannel(
    channel: PendingChannel,
    run: () => Promise<ChannelRunOutcome>,
    isRetriable: (reason: string) => boolean,
    label: string,
    taskId: string,
  ): Promise<ChannelAttemptResult> {
    const outcome = await run()
    if (outcome.status === 'ok') {
      return 'ok'
    }

    if (!isRetriable(outcome.reason)) {
      console.warn(`[planetz] ${label}: not retrying task ${taskId} (${outcome.reason})`)
      return 'settled'
    }

    channel.attempts += 1
    channel.nextRetryAt = Date.now() + TASK_REPORT_INGEST_RETRY_INTERVAL_MS
    if (channel.attempts >= TASK_REPORT_INGEST_MAX_ATTEMPTS) {
      console.warn(
        `[planetz] ${label}: giving up for task ${taskId} after ${TASK_REPORT_INGEST_MAX_ATTEMPTS} attempts (${outcome.reason})`,
      )
      return 'settled'
    }

    return 'retry'
  }

  reset(): void {
    this.previousStatuses.clear()
    this.pendingIngest.clear()
  }
}
