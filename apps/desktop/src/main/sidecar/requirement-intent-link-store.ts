import type { RequirementIntentLink } from '@planetz/shared'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import {
  countRequirementIntentLinksBySourceTaskId,
  listRequirementIntentLinksByThread,
  upsertRequirementIntentLink,
} from '../storage/sqlite/repositories/requirement-intent-link-repository.js'
import type { SidecarPaths } from './sidecar-paths.js'

export class RequirementIntentLinkStore {
  async upsert(
    paths: SidecarPaths,
    input: Omit<RequirementIntentLink, 'createdAt'> & { createdAt?: string },
  ): Promise<void> {
    const db = await getSidecarSqlite(paths)
    upsertRequirementIntentLink(db, {
      reqId: input.reqId,
      threadId: input.threadId,
      decidedIntentVersion: input.decidedIntentVersion,
      rationale: input.rationale,
      sourceTaskId: input.sourceTaskId,
      createdAt: input.createdAt ?? new Date().toISOString(),
    })
  }

  async listByThread(paths: SidecarPaths, threadId: string): Promise<RequirementIntentLink[]> {
    const db = await getSidecarSqlite(paths)
    return listRequirementIntentLinksByThread(db, threadId)
  }

  async countBySourceTaskId(paths: SidecarPaths, sourceTaskId: string): Promise<number> {
    const db = await getSidecarSqlite(paths)
    return countRequirementIntentLinksBySourceTaskId(db, sourceTaskId)
  }
}
