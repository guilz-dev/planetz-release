/** Higher rank wins when choosing the Detail "Result" preview report. */
export const RESULT_PRIMARY_FORMAT_PREFERENCE_ORDER = [
  'summary',
  'validation',
  'result',
  'answer',
  'qa_review',
  'review',
] as const

/** Planning / decomposition outputs — deprioritized vs deliverable reports. */
export const RESULT_PRIMARY_PLANNING_FORMATS: ReadonlySet<string> = new Set([
  'plan',
  'analysis',
  'decompose',
  'requirements',
  'design',
  'approach',
])

const PREFERRED_RANK_BASE = 1000
const UNKNOWN_DELIVERABLE_RANK = 500
const PLANNING_RANK = 0

function normalizeReportFormatKey(formatKey: string | undefined, fileBaseName: string): string {
  if (formatKey?.trim()) return formatKey.trim().toLowerCase()
  return fileBaseName.replace(/\.(md|txt|markdown)$/i, '').toLowerCase()
}

/** Score used to pick which report is shown as the primary Result preview. */
export function rankTaskReportForPrimary(input: {
  formatKey?: string
  fileBaseName: string
}): number {
  const key = normalizeReportFormatKey(input.formatKey, input.fileBaseName)
  const baseLower = input.fileBaseName.toLowerCase()

  if (baseLower === 'summary.md' || key === 'summary') {
    return PREFERRED_RANK_BASE
  }

  const prefIndex = (RESULT_PRIMARY_FORMAT_PREFERENCE_ORDER as readonly string[]).indexOf(key)
  if (prefIndex >= 0) {
    return PREFERRED_RANK_BASE - prefIndex
  }

  if (RESULT_PRIMARY_PLANNING_FORMATS.has(key)) {
    return PLANNING_RANK
  }

  return UNKNOWN_DELIVERABLE_RANK
}
