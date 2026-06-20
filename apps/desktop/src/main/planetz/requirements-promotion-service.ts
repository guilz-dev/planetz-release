import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  allocateNextRequirementId,
  deriveRequirementsFeatureSlug,
  formatAdoptedRequirementBlock,
  INTENT_LEDGER_OBSERVATION_REPORT_FILE,
  REQUIREMENTS_REPORT_FILE,
} from '@planetz/shared'
import type { ResolveTaskResultInput } from '../lib/task-result-input.js'
import { resolveTaskReportFileLocation } from '../lib/task-run-locations.js'
import type { IntentLedgerStore } from '../sidecar/intent-ledger-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

export type RequirementsPromotionResult =
  | { status: 'promoted'; reqId: string; requirementsPath: string }
  | { status: 'skipped'; reason: string }

export class RequirementsPromotionService {
  constructor(private readonly intentLedgerStore: IntentLedgerStore) {}

  async promoteAdoptedEntry(input: {
    paths: SidecarPaths
    entryId: string
    resolveTaskResult: ResolveTaskResultInput
  }): Promise<RequirementsPromotionResult> {
    const entry = await this.intentLedgerStore.getById(input.paths, input.entryId)
    if (!entry) {
      return { status: 'skipped', reason: 'entry_not_found' }
    }

    const resolution = await resolveTaskReportFileLocation(
      input.resolveTaskResult,
      REQUIREMENTS_REPORT_FILE,
    )
    if (resolution.status !== 'found') {
      return { status: 'skipped', reason: `requirements_${resolution.status}` }
    }

    const requirementsPath = join(resolution.reportsDir, REQUIREMENTS_REPORT_FILE)
    let existing = ''
    try {
      existing = await readFile(requirementsPath, 'utf8')
    } catch {
      existing = '# Requirements\n'
    }

    const featureSlug = deriveRequirementsFeatureSlug({
      relatedReqIds: entry.satisfies,
      scopeHint: entry.scopeHint,
      taskId: entry.taskId,
    })
    const reqId = allocateNextRequirementId(existing, featureSlug)
    const block = formatAdoptedRequirementBlock({
      reqId,
      statement: entry.statement,
      sourceRun: entry.sourceRun,
      decisionId: entry.decisionId,
    })

    await writeFile(requirementsPath, `${existing.trimEnd()}${block}`, 'utf8')
    return { status: 'promoted', reqId, requirementsPath }
  }
}

/** Report file names used by adopt promotion resolution (exported for tests). */
export const REQUIREMENTS_PROMOTION_REPORT_FILES = {
  requirements: REQUIREMENTS_REPORT_FILE,
  observation: INTENT_LEDGER_OBSERVATION_REPORT_FILE,
} as const
