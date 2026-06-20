import type { TaskResultBundle } from '@planetz/shared'
import { useCallback, useEffect, useState } from 'react'

export function useTaskResultBundle(
  taskId: string,
  enabled: boolean,
  _updatedAt: string,
): {
  bundle: TaskResultBundle | null
  loading: boolean
  reload: () => void
} {
  const [bundle, setBundle] = useState<TaskResultBundle | null>(null)
  const [loading, setLoading] = useState(enabled)

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      try {
        const next = await window.orbit.getTaskResult({ taskId })
        if (signal.aborted) return
        setBundle(
          next ?? {
            taskId,
            reports: [],
            status: 'error',
            errorCode: 'read_failed',
          },
        )
      } catch {
        if (signal.aborted) return
        setBundle({
          taskId,
          reports: [],
          status: 'error',
          errorCode: 'read_failed',
        })
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [taskId],
  )

  const reload = useCallback(() => {
    const ac = new AbortController()
    void load(ac.signal)
  }, [load])

  useEffect(() => {
    if (!enabled) {
      setBundle(null)
      setLoading(false)
      return
    }
    const ac = new AbortController()
    setBundle(null)
    setLoading(true)
    void load(ac.signal)
    return () => ac.abort()
  }, [enabled, load])

  return { bundle, loading, reload }
}
