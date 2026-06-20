import {
  KIRO_SPEC_JSON_FILE,
  type KiroSpecApprovalPhase,
  type KiroSpecSummary,
} from '@planetz/shared'
import type { IntentLedgerStore } from '../sidecar/intent-ledger-store.js'
import { KIRO_SPEC_APPROVAL_SNAPSHOT_KV_KEY } from '../sidecar/sidecar-kv-keys.js'
import type { SidecarPaths } from '../sidecar/sidecar-store.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import type { KiroSpecStore } from './kiro-spec-store.js'

type ApprovalPhaseSnapshot = Partial<Record<KiroSpecApprovalPhase, boolean | undefined>>

type ApprovalSnapshot = Record<string, ApprovalPhaseSnapshot>

function buildApprovalSnapshot(specs: KiroSpecSummary[]): ApprovalSnapshot {
  const out: ApprovalSnapshot = {}
  for (const spec of specs) {
    if (spec.parseStatus !== 'ok') continue
    out[spec.featureId] = {
      requirements: spec.approvals?.requirements?.approved,
      design: spec.approvals?.design?.approved,
      tasks: spec.approvals?.tasks?.approved,
    }
  }
  return out
}

function detectNewApprovalEntries(
  previous: ApprovalSnapshot,
  next: ApprovalSnapshot,
  specs: KiroSpecSummary[],
): Array<{
  taskId: string
  sourceRun: string
  decisionId: string
  statement: string
  authority: 'required'
  sourceDoc: string
  sourceRunDoc: string
  createdAt: string
}> {
  const createdAt = new Date().toISOString()
  const entries: Array<{
    taskId: string
    sourceRun: string
    decisionId: string
    statement: string
    authority: 'required'
    sourceDoc: string
    sourceRunDoc: string
    createdAt: string
  }> = []

  for (const spec of specs) {
    if (spec.parseStatus !== 'ok') continue
    const prevFeature = previous[spec.featureId] ?? {}
    const nextFeature = next[spec.featureId] ?? {}
    for (const phase of ['requirements', 'design', 'tasks'] as const) {
      const wasApproved = prevFeature[phase] === true
      const nowApproved = nextFeature[phase] === true
      if (wasApproved || !nowApproved) continue
      entries.push({
        taskId: `kiro:${spec.featureId}`,
        sourceRun: 'spec-approval',
        decisionId: `approval:${phase}`,
        statement: `Kiro spec "${spec.featureId}": ${phase} phase approved`,
        authority: 'required',
        sourceDoc: `${spec.specDirRel}/${KIRO_SPEC_JSON_FILE}`,
        sourceRunDoc: KIRO_SPEC_JSON_FILE,
        createdAt,
      })
    }
  }

  return entries
}

export class SpecApprovalIngestService {
  constructor(
    private readonly intentLedgerStore: IntentLedgerStore,
    private readonly kiroSpecStore: KiroSpecStore,
  ) {}

  async sync(
    workspacePath: string,
    paths: SidecarPaths,
    specs?: KiroSpecSummary[],
  ): Promise<number> {
    const resolvedSpecs = specs ?? (await this.kiroSpecStore.listSpecs(workspacePath))
    const next = buildApprovalSnapshot(resolvedSpecs)
    const db = await getSidecarSqlite(paths)
    const previousRaw = readKvJson(db, KIRO_SPEC_APPROVAL_SNAPSHOT_KV_KEY)
    const previous =
      previousRaw && typeof previousRaw === 'object' && !Array.isArray(previousRaw)
        ? (previousRaw as ApprovalSnapshot)
        : {}

    const isInitialSeed = Object.keys(previous).length === 0 && Object.keys(next).length > 0

    if (!isInitialSeed) {
      const entries = detectNewApprovalEntries(previous, next, resolvedSpecs)
      if (entries.length > 0) {
        const ok = await this.intentLedgerStore.upsertMany(paths, entries)
        if (!ok) {
          console.warn('[planetz] kiro spec approval ingest: persist failed')
          return 0
        }
        writeKvJson(db, KIRO_SPEC_APPROVAL_SNAPSHOT_KV_KEY, next)
        return entries.length
      }
    }

    writeKvJson(db, KIRO_SPEC_APPROVAL_SNAPSHOT_KV_KEY, next)
    return 0
  }
}
