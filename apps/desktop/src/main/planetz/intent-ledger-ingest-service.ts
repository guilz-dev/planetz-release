import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DecisionReportSchema,
  filterValidObservationItems,
  INTENT_LEDGER_DECISIONS_REPORT_FILE,
  INTENT_LEDGER_OBSERVATION_REPORT_FILE,
  type IntentLedgerAuthority,
  ObservationReportSchema,
  observationDecisionId,
} from '@planetz/shared'
import type { ResolveTaskResultInput } from '../lib/task-result-input.js'
import { resolveTaskReportFileLocation } from '../lib/task-run-locations.js'
import type { IntentLedgerStore } from '../sidecar/intent-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

/** Max ingest attempts per completed task before giving up (warn + skip). */
export const TASK_REPORT_INGEST_MAX_ATTEMPTS = 5

/** Minimum delay between ingest retries while waiting for late report writes. */
export const TASK_REPORT_INGEST_RETRY_INTERVAL_MS = 2_000

/** @deprecated Use {@link TASK_REPORT_INGEST_MAX_ATTEMPTS}. */
export const INTENT_LEDGER_INGEST_MAX_ATTEMPTS = TASK_REPORT_INGEST_MAX_ATTEMPTS

/** @deprecated Use {@link TASK_REPORT_INGEST_RETRY_INTERVAL_MS}. */
export const INTENT_LEDGER_INGEST_RETRY_INTERVAL_MS = TASK_REPORT_INGEST_RETRY_INTERVAL_MS

export type IntentLedgerIngestSkipReason =
  | 'no_run'
  | 'path_denied'
  | 'missing_report'
  | 'invalid_report'
  | 'persist_failed'

export type IntentLedgerIngestOutcome =
  | { status: 'ok'; ingested: number }
  | { status: 'skip'; reason: IntentLedgerIngestSkipReason }

export function isRetriableIntentLedgerIngestSkip(reason: IntentLedgerIngestSkipReason): boolean {
  return reason === 'missing_report' || reason === 'no_run' || reason === 'persist_failed'
}

function parseDecisionReport(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { success: false as const, error: null }
  }
  return DecisionReportSchema.safeParse(parsed)
}

function parseObservationReport(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { success: false as const, error: null }
  }
  return ObservationReportSchema.safeParse(parsed)
}

export class IntentLedgerIngestService {
  constructor(private readonly store: IntentLedgerStore) {}

  async ingestCompletedTask(
    paths: SidecarPaths,
    input: ResolveTaskResultInput,
  ): Promise<IntentLedgerIngestOutcome> {
    const decisionsResolution = await resolveTaskReportFileLocation(
      input,
      INTENT_LEDGER_DECISIONS_REPORT_FILE,
    )
    if (decisionsResolution.status === 'no_run') {
      return { status: 'skip', reason: 'no_run' }
    }
    if (decisionsResolution.status === 'path_denied') {
      console.warn(`[planetz] intent ledger ingest: reports path denied for task ${input.taskId}`)
      return { status: 'skip', reason: 'path_denied' }
    }

    const observationResolution = await resolveTaskReportFileLocation(
      input,
      INTENT_LEDGER_OBSERVATION_REPORT_FILE,
    )

    let reportsDir: string
    let sourceRun: string
    if (decisionsResolution.status === 'found') {
      reportsDir = decisionsResolution.reportsDir
      sourceRun = decisionsResolution.runDirSlug
    } else if (observationResolution.status === 'found') {
      reportsDir = observationResolution.reportsDir
      sourceRun = observationResolution.runDirSlug
    } else {
      const runLabel =
        (decisionsResolution.status === 'missing_report'
          ? decisionsResolution.runDirSlug
          : undefined) ??
        (observationResolution.status === 'missing_report'
          ? observationResolution.runDirSlug
          : undefined) ??
        'unknown'
      console.warn(
        `[planetz] intent ledger ingest: no ${INTENT_LEDGER_DECISIONS_REPORT_FILE} or ${INTENT_LEDGER_OBSERVATION_REPORT_FILE} for task ${input.taskId} (run ${runLabel})`,
      )
      return { status: 'skip', reason: 'missing_report' }
    }

    const createdAt = new Date().toISOString()

    let ingested = 0
    let foundReport = false
    let invalidReport = false

    const decisionsPath = join(reportsDir, INTENT_LEDGER_DECISIONS_REPORT_FILE)
    try {
      const raw = await readFile(decisionsPath, 'utf8')
      foundReport = true
      const validated = parseDecisionReport(raw)
      if (!validated.success) {
        console.warn(
          `[planetz] intent ledger ingest: invalid JSON or schema in ${INTENT_LEDGER_DECISIONS_REPORT_FILE} for task ${input.taskId}`,
          validated.error?.flatten?.() ?? validated.error,
        )
        invalidReport = true
      } else if (validated.data.decisions.length > 0) {
        const entries = validated.data.decisions.map((decision) => ({
          taskId: input.taskId,
          sourceRun,
          decisionId: decision.decisionId,
          statement: decision.statement,
          authority: decision.authority as IntentLedgerAuthority,
          ...(decision.scopeHint ? { scopeHint: decision.scopeHint } : {}),
          ...(decision.source ? { sourceDoc: decision.source } : {}),
          ...(decision.satisfies?.length ? { satisfies: decision.satisfies } : {}),
          ...(decision.deviates?.length ? { deviates: decision.deviates } : {}),
          ...(decision.reversibility ? { reversibility: decision.reversibility } : {}),
          sourceRunDoc: INTENT_LEDGER_DECISIONS_REPORT_FILE,
          createdAt,
        }))
        const ok = await this.store.upsertMany(paths, entries)
        if (!ok) {
          return { status: 'skip', reason: 'persist_failed' }
        }
        ingested += entries.length
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code !== 'ENOENT') {
        console.warn(
          `[planetz] intent ledger ingest: failed to read ${INTENT_LEDGER_DECISIONS_REPORT_FILE} for task ${input.taskId}`,
          error,
        )
      }
    }

    const observationPath = join(reportsDir, INTENT_LEDGER_OBSERVATION_REPORT_FILE)
    try {
      const raw = await readFile(observationPath, 'utf8')
      foundReport = true
      const validated = parseObservationReport(raw)
      if (!validated.success) {
        console.warn(
          `[planetz] intent ledger ingest: invalid JSON or schema in ${INTENT_LEDGER_OBSERVATION_REPORT_FILE} for task ${input.taskId}`,
          validated.error?.flatten?.() ?? validated.error,
        )
        invalidReport = true
      } else {
        const validObservations = filterValidObservationItems(validated.data.observations)
        const dropped = validated.data.observations.length - validObservations.length
        if (dropped > 0) {
          console.warn(
            `[planetz] intent ledger ingest: dropped ${dropped} observation row(s) without evidence for task ${input.taskId}`,
          )
        }
        if (validObservations.length > 0) {
          const entries = validObservations.map((observation) => ({
            taskId: input.taskId,
            sourceRun,
            decisionId: observationDecisionId(observation, (value) =>
              createHash('sha256').update(value).digest('hex').slice(0, 12),
            ),
            statement: observation.statement,
            authority: 'observed' as IntentLedgerAuthority,
            ...(observation.relatedReqIds?.length ? { satisfies: observation.relatedReqIds } : {}),
            sourceDoc: observation.evidence,
            sourceRunDoc: INTENT_LEDGER_OBSERVATION_REPORT_FILE,
            observedUnanchored: observation.unanchored,
            createdAt,
          }))
          const ok = await this.store.upsertMany(paths, entries)
          if (!ok) {
            return { status: 'skip', reason: 'persist_failed' }
          }
          ingested += entries.length
        }
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code !== 'ENOENT') {
        console.warn(
          `[planetz] intent ledger ingest: failed to read ${INTENT_LEDGER_OBSERVATION_REPORT_FILE} for task ${input.taskId}`,
          error,
        )
      }
    }

    if (!foundReport) {
      console.warn(
        `[planetz] intent ledger ingest: readable ${INTENT_LEDGER_DECISIONS_REPORT_FILE} / ${INTENT_LEDGER_OBSERVATION_REPORT_FILE} missing for task ${input.taskId} (run ${sourceRun})`,
      )
      return { status: 'skip', reason: 'missing_report' }
    }

    if (invalidReport && ingested === 0) {
      return { status: 'skip', reason: 'invalid_report' }
    }

    return { status: 'ok', ingested }
  }
}
