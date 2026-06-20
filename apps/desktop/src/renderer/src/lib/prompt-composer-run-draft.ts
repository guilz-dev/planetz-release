import type { WorkflowMode, WorkflowRunOverride } from '@planetz/shared'

/** Draft passed from PromptComposer to enqueue / run-now handlers. */
export interface PromptComposerRunDraft {
  body: string
  workflowMode: WorkflowMode
  workflow?: string
  provider?: string
  model?: string
  routingPreviewToken?: string
  routingPromptHash?: string
  confirmedWorkflow?: string
  runOverride?: WorkflowRunOverride
  workflowSelectionKind?: 'auto' | 'modified' | 'manual'
  /** Originating conversation thread id; carried through to the task<->thread link. */
  sourceThreadId?: string
}
