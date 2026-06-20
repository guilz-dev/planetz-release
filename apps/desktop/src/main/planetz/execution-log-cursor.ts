import type { RunEvent } from '@planetz/shared'

export interface LogCursorPayload {
  at: string
  id: string
}

/** Base id before occurrence suffix; used for cursor tie-break. */
export function stableLogRecordBaseId(parts: {
  runId: string
  at: string
  eventType: string
}): string {
  return `${parts.runId}:${parts.at}:${parts.eventType}`
}

/** @deprecated Use {@link stableLogRecordBaseId} for the unsuffixed base; full ids come from {@link assignStableLogRecordIds}. */
export function stableLogRecordId(parts: { runId: string; at: string; eventType: string }): string {
  return stableLogRecordBaseId(parts)
}

export function stableLogRecordIdWithOccurrence(baseId: string, occurrenceIndex: number): string {
  return occurrenceIndex === 0 ? baseId : `${baseId}~${occurrenceIndex}`
}

function compareRunEventsForStableId(a: RunEvent, b: RunEvent): number {
  const atCmp = a.at.localeCompare(b.at)
  if (atCmp !== 0) return atCmp
  const runCmp = a.runId.localeCompare(b.runId)
  if (runCmp !== 0) return runCmp
  const typeCmp = a.type.localeCompare(b.type)
  if (typeCmp !== 0) return typeCmp
  const msgCmp = (a.message ?? '').localeCompare(b.message ?? '')
  if (msgCmp !== 0) return msgCmp
  return (a.level ?? '').localeCompare(b.level ?? '')
}

/** Deterministic ids for events in the same array (survives filter/sort downstream). */
export function assignStableLogRecordIds(events: readonly RunEvent[]): string[] {
  const indices = events.map((_, index) => index)
  indices.sort((left, right) =>
    compareRunEventsForStableId(events[left] as RunEvent, events[right] as RunEvent),
  )
  const ids = new Array<string>(events.length)
  const occurrenceByBase = new Map<string, number>()
  for (const index of indices) {
    const event = events[index] as RunEvent
    const base = stableLogRecordBaseId({
      runId: event.runId,
      at: event.at,
      eventType: event.type,
    })
    const occurrence = occurrenceByBase.get(base) ?? 0
    occurrenceByBase.set(base, occurrence + 1)
    ids[index] = stableLogRecordIdWithOccurrence(base, occurrence)
  }
  return ids
}

export function encodeLogCursor(payload: LogCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeLogCursor(raw: string): LogCursorPayload {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'at' in parsed &&
      'id' in parsed &&
      typeof (parsed as LogCursorPayload).at === 'string' &&
      typeof (parsed as LogCursorPayload).id === 'string'
    ) {
      return parsed as LogCursorPayload
    }
  } catch {
    // fall through
  }
  throw new Error('Invalid execution log cursor')
}

/** True when record sorts before cursor in descending (at, id) order. */
export function isLogRecordBeforeCursor(
  record: { at: string; id: string },
  cursor: LogCursorPayload,
): boolean {
  if (record.at < cursor.at) return true
  if (record.at === cursor.at && record.id < cursor.id) return true
  return false
}
