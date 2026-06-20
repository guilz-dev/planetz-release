import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  computeValidationCoverage,
  parseRequirementIdsFromMarkdown,
  REQUIREMENTS_REPORT_FILE,
  type ValidationCoverageSummary,
} from '@planetz/shared'
import type { ResolveTaskResultInput } from '../lib/task-result-input.js'
import { resolveTaskReportFileLocation } from '../lib/task-run-locations.js'
import type { ConversationLedgerStore } from '../sidecar/conversation-ledger-store.js'
import type { RequirementIntentLinkStore } from '../sidecar/requirement-intent-link-store.js'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { TaskThreadLinkStore } from '../sidecar/task-thread-link-store.js'
import type { DecidedIntentReadPort } from './decided-intent-read-port.js'

export class ValidationCoverageService {
  constructor(
    private readonly conversationLedgerStore: ConversationLedgerStore,
    private readonly taskThreadLinkStore: TaskThreadLinkStore,
    private readonly decidedIntentReadPort: DecidedIntentReadPort,
    private readonly linkStore: RequirementIntentLinkStore,
    private readonly resolveTaskResult: (taskId: string) => ResolveTaskResultInput | null,
  ) {}

  async summarize(paths: SidecarPaths, workspacePath: string): Promise<ValidationCoverageSummary> {
    const threads = await this.conversationLedgerStore.listOpen(paths, workspacePath)
    const threadInputs = []
    const reqIdsByTaskId = new Map<string, string[]>()

    for (const thread of threads) {
      const taskIds = await this.taskThreadLinkStore.listTaskIds(paths, thread.threadId)
      const requirementIdSet = new Set<string>()

      for (const taskId of taskIds) {
        const reqIds = await this.loadRequirementIdsForTask(taskId, reqIdsByTaskId)
        for (const reqId of reqIds) {
          requirementIdSet.add(reqId)
        }
      }

      const links = await this.linkStore.listByThread(paths, thread.threadId)
      const linkedReqIds = links.map((link) => link.reqId)
      const intent = await this.decidedIntentReadPort.getCurrent(paths, thread.threadId)

      threadInputs.push({
        threadId: thread.threadId,
        requirementIds: [...requirementIdSet].sort(),
        linkedReqIds,
        hasDecidedIntent: intent !== null,
      })
    }

    return computeValidationCoverage({ threads: threadInputs })
  }

  private async loadRequirementIdsForTask(
    taskId: string,
    cache: Map<string, string[]>,
  ): Promise<string[]> {
    const cached = cache.get(taskId)
    if (cached) return cached

    const input = this.resolveTaskResult(taskId)
    if (!input) {
      cache.set(taskId, [])
      return []
    }

    const resolution = await resolveTaskReportFileLocation(input, REQUIREMENTS_REPORT_FILE)
    if (resolution.status !== 'found') {
      cache.set(taskId, [])
      return []
    }

    try {
      const markdown = await readFile(join(resolution.reportsDir, REQUIREMENTS_REPORT_FILE), 'utf8')
      const reqIds = parseRequirementIdsFromMarkdown(markdown)
      cache.set(taskId, reqIds)
      return reqIds
    } catch {
      cache.set(taskId, [])
      return []
    }
  }
}
