import type { Dirent } from 'node:fs'
import { access, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  formatRunId,
  isExternalExecutorId,
  rankTaskReportForPrimary,
  TASK_RESULT_MAX_BYTES,
  type TaskReportArtifact,
  type TaskResultBundle,
} from '@planetz/shared'
import {
  contractCandidateFileNames,
  type FlatOutputContract,
  flattenWorkflowOutputContracts,
} from '../../shared/workflow-form/workflow-output-contracts.js'
import type { ResolveTaskResultInput } from './task-result-input.js'

export type { ResolveTaskResultInput } from './task-result-input.js'

import { listRunLocationsForTask, type TaskRunLocation } from './task-run-locations.js'
import { isPathUnderAllowedRoot, resolveAllowedWorkDirRoots } from './task-work-dir.js'
import { readTaskYamlRow } from './tasks-yaml-reader.js'

const REPORT_FILE_EXTENSIONS = new Set(['.md', '.txt', '.markdown'])

interface ReportFileRef {
  fileName: string
  reportsDir: string
}

async function scoreReportsDir(reportsDir: string): Promise<number> {
  const fileNames = await collectReportFileNames(reportsDir)
  if (fileNames.length === 0) return 0
  let maxRank = 0
  for (const fileName of fileNames) {
    const rank = rankTaskReportForPrimary({ fileBaseName: reportBaseName(fileName) })
    maxRank = Math.max(maxRank, rank)
  }
  return maxRank * 1000 + fileNames.length
}

/** Pick the run root used for bundle metadata (path display, external note). */
async function pickCanonicalRunLocation(
  locations: TaskRunLocation[],
): Promise<TaskRunLocation | null> {
  if (locations.length === 0) return null
  let best: { resolved: TaskRunLocation; score: number } | null = null
  for (const resolved of locations) {
    const score = await scoreReportsDir(resolved.reportsDir)
    if (!best || score > best.score) {
      best = { resolved, score }
    }
  }
  return best?.resolved ?? locations[0] ?? null
}

/**
 * Merge report files across every resolved run root for the same slug.
 * When worktree and main both have a run dir, prefer the higher-ranked artifact per path.
 */
async function mergeReportFilesAcrossRunLocations(
  locations: TaskRunLocation[],
): Promise<ReportFileRef[]> {
  const byFileName = new Map<string, ReportFileRef & { rank: number }>()
  for (const location of locations) {
    const fileNames = await collectReportFileNames(location.reportsDir)
    for (const fileName of fileNames) {
      const rank = rankTaskReportForPrimary({ fileBaseName: reportBaseName(fileName) })
      const existing = byFileName.get(fileName)
      if (!existing || rank > existing.rank) {
        byFileName.set(fileName, {
          fileName,
          reportsDir: location.reportsDir,
          rank,
        })
      }
    }
  }
  return [...byFileName.values()].map(({ fileName, reportsDir }) => ({ fileName, reportsDir }))
}

function reportFileExtension(fileName: string): string {
  return fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : ''
}

/** Collect report paths relative to reportsDir (recursive; matches takt runSessionReader). */
async function collectReportFileNames(reportsDir: string): Promise<string[]> {
  const results: string[] = []

  async function walk(currentDir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(currentDir, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      return
    }
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of sorted) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      if (!REPORT_FILE_EXTENSIONS.has(reportFileExtension(entry.name))) continue
      results.push(relative(reportsDir, fullPath))
    }
  }

  try {
    await access(reportsDir)
  } catch {
    return []
  }
  await walk(reportsDir)
  return results
}

async function readReportContent(
  reportsDir: string,
  fileName: string,
): Promise<{ content: string; truncated: boolean }> {
  const abs = join(reportsDir, fileName)
  const buf = await readFile(abs)
  const truncated = buf.byteLength > TASK_RESULT_MAX_BYTES
  const slice = truncated ? buf.subarray(0, TASK_RESULT_MAX_BYTES) : buf
  return { content: slice.toString('utf8'), truncated }
}

function matchArtifactToContract(
  fileName: string,
  contracts: FlatOutputContract[],
): FlatOutputContract | undefined {
  return contracts.find((c) => contractCandidateFileNames(c).includes(fileName))
}

function buildArtifactSkeletons(
  fileNames: string[],
  contracts: FlatOutputContract[],
): TaskReportArtifact[] {
  return fileNames.map((fileName) => {
    const baseName = fileName.includes('/') ? (fileName.split('/').pop() ?? fileName) : fileName
    const match = matchArtifactToContract(baseName, contracts)
    return {
      fileName,
      relativePath: `reports/${fileName}`,
      ...(match?.stepName ? { stepName: match.stepName } : {}),
      ...(match?.format ? { formatKey: match.format } : {}),
      content: '',
    }
  })
}

function reportBaseName(fileName: string): string {
  return fileName.includes('/') ? (fileName.split('/').pop() ?? fileName) : fileName
}

function contractStepOrderForArtifact(
  artifact: TaskReportArtifact,
  contracts: FlatOutputContract[],
): number {
  const base = reportBaseName(artifact.fileName)
  let last = -1
  for (let i = 0; i < contracts.length; i += 1) {
    const contract = contracts[i]
    if (!contract) continue
    if (contractCandidateFileNames(contract).includes(base)) {
      last = i
    }
  }
  return last
}

function pickPrimaryIndex(
  artifacts: TaskReportArtifact[],
  contracts: FlatOutputContract[],
): number {
  if (artifacts.length === 0) return 0

  let bestIdx = 0
  let bestRank = Number.NEGATIVE_INFINITY
  let bestStepOrder = Number.NEGATIVE_INFINITY

  for (let i = 0; i < artifacts.length; i += 1) {
    const artifact = artifacts[i]
    if (!artifact) continue
    const base = reportBaseName(artifact.fileName)
    const rank = rankTaskReportForPrimary({
      formatKey: artifact.formatKey,
      fileBaseName: base,
    })
    const stepOrder = contractStepOrderForArtifact(artifact, contracts)
    if (
      rank > bestRank ||
      (rank === bestRank && stepOrder > bestStepOrder) ||
      (rank === bestRank && stepOrder === bestStepOrder && i > bestIdx)
    ) {
      bestRank = rank
      bestStepOrder = stepOrder
      bestIdx = i
    }
  }

  return bestIdx
}

async function loadReportArtifacts(
  fileRefs: ReportFileRef[],
  contracts: FlatOutputContract[],
): Promise<TaskReportArtifact[]> {
  const fileNames = fileRefs.map((ref) => ref.fileName)
  const skeletons = buildArtifactSkeletons(fileNames, contracts)
  const reports: TaskReportArtifact[] = []
  for (const skeleton of skeletons) {
    const ref = fileRefs.find((candidate) => candidate.fileName === skeleton.fileName)
    if (!ref) continue
    try {
      const { content, truncated } = await readReportContent(ref.reportsDir, skeleton.fileName)
      reports.push({
        ...skeleton,
        content,
        ...(truncated ? { truncated: true } : {}),
      })
    } catch {
      // Skip unreadable entries (symlinks, directories named *.md, permission errors).
    }
  }
  return reports
}

function bundleBase(taskId: string, runsDirRel: string): TaskResultBundle {
  return {
    taskId,
    runsDirRel,
    reports: [],
    status: 'no_run',
  }
}

function externalBundle(
  taskId: string,
  runsDirRel: string,
  partial?: Pick<TaskResultBundle, 'runDirSlug' | 'runId' | 'reportsPath'>,
): TaskResultBundle {
  return {
    ...bundleBase(taskId, runsDirRel),
    ...partial,
    status: 'external',
  }
}

export async function resolveTaskResultBundle(
  input: ResolveTaskResultInput,
): Promise<TaskResultBundle> {
  const { taktRepoPath, workspacePath, config, taskId, readWorkflowYaml } = input
  const runsDirRel = config.runsDir

  try {
    const row = await readTaskYamlRow(taktRepoPath, config, taskId)
    if (!row) {
      return {
        ...bundleBase(taskId, runsDirRel),
        status: 'error',
        errorCode: 'task_not_found',
      }
    }

    const allowedRoots = resolveAllowedWorkDirRoots(taktRepoPath, workspacePath)
    const runLocations = await listRunLocationsForTask(input, row)
    const runLocation = await pickCanonicalRunLocation(runLocations)
    if (!runLocation) {
      if (isExternalExecutorId(input.assignedAgentId)) {
        return externalBundle(taskId, runsDirRel)
      }
      return bundleBase(taskId, runsDirRel)
    }

    const reportFileRefs = await mergeReportFilesAcrossRunLocations(runLocations)
    const allowedReportRefs = reportFileRefs.filter((ref) =>
      isPathUnderAllowedRoot(ref.reportsDir, allowedRoots),
    )
    if (allowedReportRefs.length === 0 && reportFileRefs.length > 0) {
      return {
        ...bundleBase(taskId, runsDirRel),
        status: 'error',
        errorCode: 'path_denied',
      }
    }

    let contracts: FlatOutputContract[] = []
    const workflowName = typeof row.workflow === 'string' ? row.workflow.trim() : ''
    if (workflowName) {
      const yaml = await readWorkflowYaml(workflowName)
      if (yaml) contracts = flattenWorkflowOutputContracts(yaml)
    }

    if (allowedReportRefs.length === 0) {
      if (isExternalExecutorId(input.assignedAgentId)) {
        return externalBundle(taskId, runsDirRel, {
          runDirSlug: runLocation.runDirSlug,
          runId: formatRunId(runLocation.runDirSlug, 'reports'),
          reportsPath: runLocation.reportsDir,
        })
      }
      return {
        ...bundleBase(taskId, runsDirRel),
        runDirSlug: runLocation.runDirSlug,
        runId: formatRunId(runLocation.runDirSlug, 'reports'),
        reportsPath: runLocation.reportsDir,
        status: 'no_reports',
        ...(contracts.length === 0 ? { noReportsReason: 'workflow_output_not_configured' } : {}),
      }
    }

    const reports = await loadReportArtifacts(allowedReportRefs, contracts)
    if (reports.length === 0) {
      return {
        ...bundleBase(taskId, runsDirRel),
        runDirSlug: runLocation.runDirSlug,
        runId: formatRunId(runLocation.runDirSlug, 'reports'),
        reportsPath: runLocation.reportsDir,
        status: 'error',
        errorCode: 'read_failed',
      }
    }

    const primaryIndex = pickPrimaryIndex(reports, contracts)
    const runId = formatRunId(runLocation.runDirSlug, 'reports')

    return {
      taskId,
      runDirSlug: runLocation.runDirSlug,
      runId,
      runsDirRel,
      reportsPath: runLocation.reportsDir,
      reports,
      primaryIndex,
      status: 'ok',
    }
  } catch {
    return {
      ...bundleBase(taskId, runsDirRel),
      status: 'error',
      errorCode: 'read_failed',
    }
  }
}
