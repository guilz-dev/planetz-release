import {
  DECIDED_INTENT_CONTEXT_FACET_KEY,
  type DecidedIntent,
  type UiConfig,
} from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import type { TaskIntentContextSnapshotStore } from '../sidecar/task-intent-context-snapshot-store.js'
import type { TaskThreadLinkStore } from '../sidecar/task-thread-link-store.js'
import { writeProjectFacet } from '../takt/facet-resolver.js'
import type { DecidedIntentReadPort } from './decided-intent-read-port.js'

export type { DecidedIntentReadPort } from './decided-intent-read-port.js'

export function formatDecidedIntentContextMarkdown(intent: DecidedIntent): string {
  const lines = [
    '# Decided intent context',
    '',
    `Based on decided intent v${intent.version}`,
    '',
    'This is the operator-confirmed intent for the originating Spec Thread.',
    'Use it when writing requirements and intent-links.json rationales.',
    '',
    '## What',
    '',
    intent.what,
    '',
    '## Why',
    '',
    intent.why,
    '',
  ]
  if (intent.outOfScope.length > 0) {
    lines.push('## Out of scope', '', intent.outOfScope.map((item) => `- ${item}`).join('\n'), '')
  }
  return lines.join('\n')
}

export function formatEmptyDecidedIntentContextMarkdown(): string {
  return [
    '# Decided intent context',
    '',
    '_No decided intent saved for the originating Spec Thread yet._',
    '',
  ].join('\n')
}

/** Read-only: inject current decided intent into the knowledge facet before analyze_requirements. */
export class DecidedIntentContextWriter {
  constructor(
    private readonly decidedIntentReadPort: DecidedIntentReadPort,
    private readonly taskThreadLinkStore: TaskThreadLinkStore,
    private readonly snapshotStore: TaskIntentContextSnapshotStore,
  ) {}

  async regenerateForTask(
    workspacePath: string,
    config: UiConfig,
    paths: SidecarPaths,
    taskId: string,
  ): Promise<boolean> {
    const threadId = await this.taskThreadLinkStore.getThreadId(paths, taskId)
    if (!threadId) return false

    const intent = await this.decidedIntentReadPort.getCurrent(paths, threadId)
    const content = intent
      ? formatDecidedIntentContextMarkdown(intent)
      : formatEmptyDecidedIntentContextMarkdown()

    await writeProjectFacet(
      workspacePath,
      config,
      'knowledge',
      DECIDED_INTENT_CONTEXT_FACET_KEY,
      content,
    )

    if (intent) {
      await this.snapshotStore.upsert(paths, {
        taskId,
        threadId,
        decidedIntentVersion: intent.version,
        capturedAt: new Date().toISOString(),
      })
    }

    return intent !== null
  }
}
