import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  INTENT_LINKS_REPORT_FILE,
  IntentLinksReportSchema,
  parseRequirementIdsFromMarkdown,
  REQUIREMENTS_REPORT_FILE,
} from '@planetz/shared'
import type { ResolveTaskResultInput } from '../lib/task-result-input.js'
import { resolveTaskReportFileLocation } from '../lib/task-run-locations.js'
import type { RequirementIntentLinkStore } from '../sidecar/requirement-intent-link-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { TaskIntentContextSnapshotStore } from '../sidecar/task-intent-context-snapshot-store.js'

export type RequirementIntentLinkIngestSkipReason =
  | 'no_run'
  | 'path_denied'
  | 'no_context_snapshot'
  | 'missing_report'
  | 'invalid_report'
  | 'persist_failed'

export type RequirementIntentLinkIngestOutcome =
  | { status: 'ok'; ingested: number }
  | { status: 'skip'; reason: RequirementIntentLinkIngestSkipReason }

export function isRetriableRequirementIntentLinkIngestSkip(
  reason: RequirementIntentLinkIngestSkipReason,
): boolean {
  return reason === 'missing_report' || reason === 'no_run' || reason === 'persist_failed'
}

export class RequirementIntentLinkIngestService {
  constructor(
    private readonly linkStore: RequirementIntentLinkStore,
    private readonly snapshotStore: TaskIntentContextSnapshotStore,
  ) {}

  async ingestCompletedTask(
    paths: SidecarPaths,
    input: ResolveTaskResultInput,
  ): Promise<RequirementIntentLinkIngestOutcome> {
    const snapshot = await this.snapshotStore.get(paths, input.taskId)
    if (!snapshot) {
      return { status: 'skip', reason: 'no_context_snapshot' }
    }

    const linksResolution = await resolveTaskReportFileLocation(input, INTENT_LINKS_REPORT_FILE)
    if (linksResolution.status === 'no_run') {
      return { status: 'skip', reason: 'no_run' }
    }
    if (linksResolution.status === 'path_denied') {
      console.warn(
        `[planetz] requirement intent link ingest: reports path denied for task ${input.taskId}`,
      )
      return { status: 'skip', reason: 'path_denied' }
    }
    if (linksResolution.status === 'missing_report') {
      console.warn(
        `[planetz] requirement intent link ingest: no ${INTENT_LINKS_REPORT_FILE} for task ${input.taskId}`,
      )
      return { status: 'skip', reason: 'missing_report' }
    }

    const requirementsResolution = await resolveTaskReportFileLocation(
      input,
      REQUIREMENTS_REPORT_FILE,
    )
    if (requirementsResolution.status !== 'found') {
      console.warn(
        `[planetz] requirement intent link ingest: no ${REQUIREMENTS_REPORT_FILE} for task ${input.taskId}`,
      )
      return { status: 'skip', reason: 'missing_report' }
    }

    let linksRaw: string
    try {
      linksRaw = await readFile(join(linksResolution.reportsDir, INTENT_LINKS_REPORT_FILE), 'utf8')
    } catch {
      return { status: 'skip', reason: 'missing_report' }
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(linksRaw)
    } catch {
      console.warn(
        `[planetz] requirement intent link ingest: invalid JSON in ${INTENT_LINKS_REPORT_FILE} for task ${input.taskId}`,
      )
      return { status: 'skip', reason: 'invalid_report' }
    }

    const parsed = IntentLinksReportSchema.safeParse(parsedJson)
    if (!parsed.success) {
      console.warn(
        `[planetz] requirement intent link ingest: schema mismatch in ${INTENT_LINKS_REPORT_FILE} for task ${input.taskId}`,
      )
      return { status: 'skip', reason: 'invalid_report' }
    }

    let requirementsMarkdown: string
    try {
      requirementsMarkdown = await readFile(
        join(requirementsResolution.reportsDir, REQUIREMENTS_REPORT_FILE),
        'utf8',
      )
    } catch {
      return { status: 'skip', reason: 'missing_report' }
    }

    const validReqIds = new Set(parseRequirementIdsFromMarkdown(requirementsMarkdown))
    const createdAt = new Date().toISOString()
    let ingested = 0

    try {
      for (const link of parsed.data.links) {
        if (!validReqIds.has(link.reqId)) continue
        await this.linkStore.upsert(paths, {
          reqId: link.reqId,
          threadId: snapshot.threadId,
          decidedIntentVersion: snapshot.decidedIntentVersion,
          rationale: link.rationale,
          sourceTaskId: input.taskId,
          createdAt,
        })
        ingested += 1
      }
    } catch (error) {
      console.warn('[planetz] requirement intent link ingest persist failed', error)
      return { status: 'skip', reason: 'persist_failed' }
    }

    return { status: 'ok', ingested }
  }
}
