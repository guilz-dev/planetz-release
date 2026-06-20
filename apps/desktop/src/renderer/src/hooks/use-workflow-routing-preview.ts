import type { WorkflowRunOverride } from '@planetz/shared'
import { useCallback, useRef, useState } from 'react'
import {
  routingPreviewToEnqueueExtras,
  type WorkflowRoutingPreviewState,
} from '../lib/workflow-low-confidence-gate.js'

const EMPTY_ROUTING: WorkflowRoutingPreviewState = {
  previewToken: null,
  promptHash: null,
  previewDecision: null,
}

export function useWorkflowRoutingPreview(runOverride?: WorkflowRunOverride) {
  const [routingPreview, setRoutingPreview] = useState<WorkflowRoutingPreviewState>(EMPTY_ROUTING)
  const routingPreviewRef = useRef(routingPreview)
  routingPreviewRef.current = routingPreview

  const applyRouting = useCallback((next: WorkflowRoutingPreviewState) => {
    routingPreviewRef.current = next
    setRoutingPreview(next)
  }, [])

  const resetRouting = useCallback(() => {
    applyRouting(EMPTY_ROUTING)
  }, [applyRouting])

  const onPreviewRoutingChange = useCallback(
    (patch: WorkflowRoutingPreviewState) => {
      applyRouting({
        ...routingPreviewRef.current,
        ...patch,
      })
    },
    [applyRouting],
  )

  const setConfirmedWorkflow = useCallback(
    (confirmedWorkflow: string | undefined) => {
      applyRouting({
        ...routingPreviewRef.current,
        ...(confirmedWorkflow ? { confirmedWorkflow } : { confirmedWorkflow: undefined }),
      })
    },
    [applyRouting],
  )

  const getEnqueueExtras = useCallback(
    () => ({
      ...routingPreviewToEnqueueExtras(routingPreviewRef.current),
      ...(runOverride ? { runOverride } : {}),
    }),
    [runOverride],
  )

  return {
    routingPreview,
    routingPreviewRef,
    applyRouting,
    resetRouting,
    onPreviewRoutingChange,
    setConfirmedWorkflow,
    getEnqueueExtras,
  }
}
