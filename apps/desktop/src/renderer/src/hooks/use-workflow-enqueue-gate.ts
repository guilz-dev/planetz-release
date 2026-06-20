import type { AutoWorkflowDecision } from '@planetz/shared'
import { type RefObject, useCallback, useState } from 'react'
import {
  ensureFullAutoPreviewForGate,
  type WorkflowRoutingPreviewState,
} from '../lib/workflow-low-confidence-gate.js'

type IssueGatePending = {
  kind: 'issue'
  draft: string
  action: 'enqueue' | 'runSingle' | 'enqueueAuto'
}

export function useWorkflowEnqueueGate(input: {
  gateEnabled: boolean
  workflowMode: 'manual' | 'auto'
  routingPreview: WorkflowRoutingPreviewState
  routingPreviewRef: RefObject<WorkflowRoutingPreviewState>
  applyRouting: (next: WorkflowRoutingPreviewState) => void
  lastAutoDecision?: AutoWorkflowDecision | null
}) {
  const [open, setOpen] = useState(false)
  const [issuePending, setIssuePending] = useState<IssueGatePending | null>(null)

  const prepareForEnqueue = useCallback(
    async (params: { body: string; title?: string; provider?: string; model?: string }) => {
      if (
        !input.gateEnabled ||
        input.workflowMode !== 'auto' ||
        input.routingPreviewRef.current.confirmedWorkflow
      ) {
        return { proceed: true as const }
      }

      const resolved = await ensureFullAutoPreviewForGate({
        gateEnabled: input.gateEnabled,
        workflowMode: input.workflowMode,
        routing: input.routingPreviewRef.current,
        title: params.title,
        body: params.body,
        provider: params.provider,
        model: params.model,
      })
      input.applyRouting(resolved)

      if (resolved.gateBlocked) {
        return { proceed: false as const, routing: resolved }
      }
      return { proceed: true as const, routing: resolved }
    },
    [input],
  )

  const openIssueGate = useCallback((pending: IssueGatePending) => {
    setIssuePending(pending)
    setOpen(true)
  }, [])

  const closeGate = useCallback(() => {
    setOpen(false)
    setIssuePending(null)
  }, [])

  const gateDecision = input.routingPreview.previewDecision ?? input.lastAutoDecision ?? null

  return {
    open,
    issuePending,
    gateDecision,
    prepareForEnqueue,
    openIssueGate,
    closeGate,
    setOpen,
    setIssuePending,
  }
}
