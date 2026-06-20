import type { WorkflowPreviewResult } from '@planetz/shared'
import { useEffect, useState } from 'react'

export function useWorkflowPreview(
  workflowName: string | null | undefined,
  enabled: boolean,
  onLoaded?: (preview: WorkflowPreviewResult) => void,
) {
  const [preview, setPreview] = useState<WorkflowPreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!enabled || !workflowName) {
      setPreview(null)
      setLoading(false)
      setLoadError(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(false)

    void window.orbit
      .getWorkflowPreview({ workflow: workflowName })
      .then((result) => {
        if (cancelled) return
        setPreview(result)
        onLoaded?.(result)
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null)
          setLoadError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, onLoaded, workflowName])

  return { preview, loading, loadError }
}
