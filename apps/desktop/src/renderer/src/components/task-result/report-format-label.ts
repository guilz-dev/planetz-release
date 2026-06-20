import type { TaskReportArtifact } from '@planetz/shared'

export function reportFormatLabel(
  report: Pick<TaskReportArtifact, 'formatKey' | 'fileName'>,
): string {
  return report.formatKey ?? report.fileName.replace(/\.md$/i, '')
}

export function formatReportSourcePath(
  bundle: { runsDirRel?: string; runDirSlug?: string },
  relativePath: string,
): string {
  const runsDir = bundle.runsDirRel ?? '.takt/runs'
  if (bundle.runDirSlug) {
    return `${runsDir}/${bundle.runDirSlug}/${relativePath}`
  }
  return relativePath
}
