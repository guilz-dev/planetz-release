import { z } from 'zod'

/** Max bytes read per report file on disk (single source of truth for truncation). */
export const TASK_RESULT_MAX_BYTES = 32_768

export const taskResultStatusSchema = z.enum(['ok', 'no_run', 'no_reports', 'external', 'error'])

export type TaskResultStatus = z.infer<typeof taskResultStatusSchema>

export const taskReportArtifactSchema = z.object({
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  stepName: z.string().optional(),
  formatKey: z.string().optional(),
  content: z.string(),
  truncated: z.boolean().optional(),
})

export type TaskReportArtifact = z.infer<typeof taskReportArtifactSchema>

export const taskResultErrorCodeSchema = z.enum(['task_not_found', 'path_denied', 'read_failed'])

export type TaskResultErrorCode = z.infer<typeof taskResultErrorCodeSchema>

export const taskResultBundleSchema = z.object({
  taskId: z.string().min(1),
  runId: z.string().optional(),
  runDirSlug: z.string().optional(),
  /** Config-relative runs directory (e.g. `.takt/runs`) for UI path display. */
  runsDirRel: z.string().optional(),
  reportsPath: z.string().optional(),
  reports: z.array(taskReportArtifactSchema),
  primaryIndex: z.number().int().nonnegative().optional(),
  status: taskResultStatusSchema,
  /** Why result reports are missing when status is `no_reports`. */
  noReportsReason: z.enum(['workflow_output_not_configured']).optional(),
  /** Machine-oriented code; user copy comes from renderer i18n. */
  errorCode: taskResultErrorCodeSchema.optional(),
})

export type TaskResultBundle = z.infer<typeof taskResultBundleSchema>

export function isExternalExecutorId(executorId: string | undefined): boolean {
  return typeof executorId === 'string' && executorId.startsWith('agent-external-')
}
