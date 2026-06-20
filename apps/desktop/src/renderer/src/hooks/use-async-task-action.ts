import type { TaskViewModel } from '@planetz/shared'
import { useCallback, useState } from 'react'

/** Busy-guarded async handler for per-task detail/lane actions. */
export function useAsyncTaskAction(onAction: (task: TaskViewModel) => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (task: TaskViewModel) => {
      if (busy) return
      setBusy(true)
      try {
        await onAction(task)
      } finally {
        setBusy(false)
      }
    },
    [busy, onAction],
  )
  return { busy, run }
}
