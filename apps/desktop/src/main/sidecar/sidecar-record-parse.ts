import type { z } from 'zod'

function logDroppedRecord(label: string, issues: z.ZodIssue[]): void {
  console.warn(`[planetz][sidecar] Dropped invalid ${label} record`, {
    issueCount: issues.length,
    paths: issues.map((issue) => issue.path.join('.')).filter((path) => path.length > 0),
  })
}

export function parseSidecarRecords<T>(
  records: unknown[],
  schema: z.ZodType<T>,
  label = 'sidecar',
): T[] {
  const parsed: T[] = []
  for (const record of records) {
    const result = schema.safeParse(record)
    if (result.success) {
      parsed.push(result.data)
      continue
    }
    logDroppedRecord(label, result.error.issues)
  }
  return parsed
}

export function parseSidecarRecord<T>(record: unknown, schema: z.ZodType<T>, label: string): T {
  const result = schema.safeParse(record)
  if (!result.success) {
    logDroppedRecord(label, result.error.issues)
    throw new Error(`Invalid ${label} sidecar record`)
  }
  return result.data
}

/** Validate every record in a bulk save; throws on the first invalid entry. */
export function parseSidecarRecordsStrict<T>(
  records: unknown[],
  schema: z.ZodType<T>,
  label: string,
): T[] {
  return records.map((record) => parseSidecarRecord(record, schema, label))
}
