import {
  CHAT_TO_TASK_METRICS_KV_KEY,
  type ChatToTaskMetricEvent,
  type ChatToTaskMetrics,
  chatToTaskMetricsSchema,
  isChatToTaskMetricEvent,
} from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import type { SidecarPaths } from './sidecar-paths.js'
import { parseSidecarRecord } from './sidecar-record-parse.js'

function emptyMetrics(): ChatToTaskMetrics {
  return { counts: {}, updatedAt: new Date().toISOString() }
}

function sanitizeMetricsRaw(raw: unknown): ChatToTaskMetrics {
  if (!raw || typeof raw !== 'object') return emptyMetrics()
  const record = raw as { counts?: Record<string, unknown>; updatedAt?: unknown }
  const counts: ChatToTaskMetrics['counts'] = {}
  if (record.counts && typeof record.counts === 'object') {
    for (const [key, value] of Object.entries(record.counts)) {
      if (
        isChatToTaskMetricEvent(key) &&
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0
      ) {
        counts[key] = value
      }
    }
  }
  return {
    counts,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  }
}

export class ChatToTaskMetricsStore {
  async load(paths: SidecarPaths): Promise<ChatToTaskMetrics> {
    const db = await getSidecarSqlite(paths)
    const raw = readKvJson(db, CHAT_TO_TASK_METRICS_KV_KEY)
    if (!raw) return emptyMetrics()
    const sanitized = sanitizeMetricsRaw(raw)
    return parseSidecarRecord(sanitized, chatToTaskMetricsSchema, 'chat to task metrics')
  }

  async record(paths: SidecarPaths, event: ChatToTaskMetricEvent): Promise<void> {
    if (!isChatToTaskMetricEvent(event)) return
    const current = await this.load(paths)
    const next: ChatToTaskMetrics = {
      counts: {
        ...current.counts,
        [event]: (current.counts[event] ?? 0) + 1,
      },
      updatedAt: new Date().toISOString(),
    }
    const db = await getSidecarSqlite(paths)
    writeKvJson(db, CHAT_TO_TASK_METRICS_KV_KEY, next)
  }
}
