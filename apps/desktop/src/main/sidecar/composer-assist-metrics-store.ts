import {
  COMPOSER_ASSIST_METRICS_KV_KEY,
  type ComposerAssistMetrics,
  composerAssistMetricsSchema,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecord } from './sidecar-record-parse.js'

export type ComposerAssistMetricPhase = 'start' | 'message' | 'finalize'
export type ComposerAssistMetricOutcome = 'success' | 'timeout' | 'error'

const EMPTY_METRICS: ComposerAssistMetrics = {
  startAttempts: 0,
  startSuccesses: 0,
  startTimeouts: 0,
  startErrors: 0,
  messageAttempts: 0,
  messageSuccesses: 0,
  messageTimeouts: 0,
  messageErrors: 0,
  finalizeAttempts: 0,
  finalizeSuccesses: 0,
  finalizeTimeouts: 0,
  finalizeErrors: 0,
  updatedAt: new Date(0).toISOString(),
}

export class ComposerAssistMetricsStore {
  async load(paths: SidecarPaths): Promise<ComposerAssistMetrics> {
    const db = await getSidecarSqlite(paths)
    const raw = readKvJson(db, COMPOSER_ASSIST_METRICS_KV_KEY)
    if (!raw) return { ...EMPTY_METRICS, updatedAt: new Date().toISOString() }
    return parseSidecarRecord(raw, composerAssistMetricsSchema, 'composer assist metrics')
  }

  async record(
    paths: SidecarPaths,
    phase: ComposerAssistMetricPhase,
    outcome: ComposerAssistMetricOutcome,
  ): Promise<void> {
    const current = await this.load(paths)
    const next = { ...current, updatedAt: new Date().toISOString() }
    const attemptKey = `${phase}Attempts` as const
    const outcomeKey =
      `${phase}${outcome === 'success' ? 'Successes' : outcome === 'timeout' ? 'Timeouts' : 'Errors'}` as const
    next[attemptKey] += 1
    next[outcomeKey] += 1
    const db = await getSidecarSqlite(paths)
    writeKvJson(db, COMPOSER_ASSIST_METRICS_KV_KEY, next)
  }
}
