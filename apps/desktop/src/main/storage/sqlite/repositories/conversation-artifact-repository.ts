import type { DatabaseSync } from 'node:sqlite'
import type {
  ArtifactRef,
  ConversationArtifactKind,
  ConversationArtifactPriority,
} from '@planetz/shared'

export type ConversationArtifactRow = {
  artifact_id: string
  thread_id: string
  artifact_ref: string
  kind: ConversationArtifactKind
  priority: ConversationArtifactPriority | null
  content_hash: string | null
  payload_json: string | null
}

export function upsertConversationArtifact(
  db: DatabaseSync,
  input: {
    artifactId: string
    threadId: string
    artifactRef: string
    kind: ConversationArtifactKind
    priority?: ConversationArtifactPriority | null
    contentHash?: string | null
    payloadJson?: string | null
  },
): void {
  db.prepare(
    `
      INSERT INTO conversation_artifacts (
        artifact_id, thread_id, artifact_ref, kind, priority, content_hash, payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(artifact_id) DO UPDATE SET
        artifact_ref = excluded.artifact_ref,
        kind = excluded.kind,
        priority = excluded.priority,
        content_hash = excluded.content_hash,
        payload_json = excluded.payload_json
    `,
  ).run(
    input.artifactId,
    input.threadId,
    input.artifactRef,
    input.kind,
    input.priority ?? null,
    input.contentHash ?? null,
    input.payloadJson ?? null,
  )
}

export function listArtifactsForThread(
  db: DatabaseSync,
  threadId: string,
): ConversationArtifactRow[] {
  return db
    .prepare(
      `
        SELECT artifact_id, thread_id, artifact_ref, kind, priority, content_hash, payload_json
        FROM conversation_artifacts
        WHERE thread_id = ?
        ORDER BY rowid ASC
      `,
    )
    .all(threadId) as ConversationArtifactRow[]
}

export function artifactRefKey(ref: ArtifactRef): string {
  return `${ref.kind}:${ref.ref}`
}

export function saveArtifactRefs(
  db: DatabaseSync,
  threadId: string,
  refs: ArtifactRef[],
  payloadByRef?: Map<string, string>,
): void {
  for (const ref of refs) {
    const key = artifactRefKey(ref)
    upsertConversationArtifact(db, {
      artifactId: `art_${threadId}_${key}`,
      threadId,
      artifactRef: ref.ref,
      kind: ref.kind,
      priority: ref.priority ?? null,
      contentHash: ref.contentHash ?? null,
      payloadJson: payloadByRef?.get(key) ?? null,
    })
  }
}
