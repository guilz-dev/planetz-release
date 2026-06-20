import type { AppState, ValidationCoverageSummary } from '@planetz/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

const EMPTY_SUMMARY: ValidationCoverageSummary = {
  orphanReqCount: 0,
  nakedIntentThreadCount: 0,
  threads: [],
}

/** Workspace-wide validation coverage (orphan REQs / naked decided intent). */
export function useWorkspaceValidationSummary() {
  const [summary, setSummary] = useState<ValidationCoverageSummary>(EMPTY_SUMMARY)

  const refresh = useCallback(async () => {
    try {
      const result = await window.orbit.getValidationCoverageSummary()
      setSummary(result)
    } catch {
      setSummary(EMPTY_SUMMARY)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    const previousStatuses = new Map<string, AppState['tasks'][number]['status']>()
    return window.orbit.onStateUpdate((state) => {
      let completedTransition = false
      for (const task of state.tasks) {
        const prev = previousStatuses.get(task.id)
        if (task.status === 'completed' && prev !== 'completed') {
          completedTransition = true
        }
        previousStatuses.set(task.id, task.status)
      }
      if (completedTransition) {
        void refreshRef.current()
      }
    })
  }, [])

  return { summary, refresh }
}
