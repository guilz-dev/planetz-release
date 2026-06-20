import { z } from 'zod'
import { type IntentLedgerEntry, IntentLedgerEntrySchema } from './intent-ledger-schema.js'

/** Persisted supply snapshot for a task run (established-decisions facet). */
export interface TaskSupplySnapshot {
  entryIds: string[]
  capturedAt: string
  matchBasis: string
}

export interface TaskSupplyTraceItem {
  taskId: string
  /** null when the task was enqueued but never run (no snapshot row). */
  snapshot: TaskSupplySnapshot | null
  /** Entries resolved from snapshot.entryIds at read time (workspace supply scope). */
  suppliedEntries?: IntentLedgerEntry[]
}

export const taskSupplySnapshotSchema = z.object({
  entryIds: z.array(z.string()),
  capturedAt: z.string(),
  matchBasis: z.string(),
})

export const taskSupplyTraceItemSchema = z.object({
  taskId: z.string(),
  snapshot: taskSupplySnapshotSchema.nullable(),
  suppliedEntries: z.array(IntentLedgerEntrySchema).optional(),
})
