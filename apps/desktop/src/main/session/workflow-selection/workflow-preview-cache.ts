import { randomUUID } from 'node:crypto'
import type { AutoWorkflowDecision, WorkflowRoutingAuditRecord } from '@planetz/shared'

export type CachedWorkflowAutoPreview = {
  promptHash: string
  phase: 'deterministic' | 'full'
  decision: AutoWorkflowDecision
  audit?: WorkflowRoutingAuditRecord
  createdAt: number
}

const PREVIEW_TTL_MS = 15 * 60 * 1000

export class WorkflowPreviewCache {
  private readonly entries = new Map<string, CachedWorkflowAutoPreview>()

  put(
    promptHash: string,
    phase: 'deterministic' | 'full',
    decision: AutoWorkflowDecision,
    audit?: WorkflowRoutingAuditRecord,
  ): string {
    this.pruneExpired()
    const previewToken = randomUUID()
    this.entries.set(previewToken, {
      promptHash,
      phase,
      decision,
      audit,
      createdAt: Date.now(),
    })
    return previewToken
  }

  get(previewToken: string, promptHash: string): CachedWorkflowAutoPreview | null {
    this.pruneExpired()
    const entry = this.entries.get(previewToken)
    if (!entry) return null
    if (entry.promptHash !== promptHash) return null
    return entry
  }

  private pruneExpired(): void {
    const now = Date.now()
    for (const [token, entry] of this.entries) {
      if (now - entry.createdAt > PREVIEW_TTL_MS) {
        this.entries.delete(token)
      }
    }
  }
}
