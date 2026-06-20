import type { TaskViewModel } from '@planetz/shared'
import { useCallback, useState } from 'react'
import type { RetryAction } from '../components/retry-action-dialog'

interface RetryDialogState {
  open: boolean
  action: RetryAction | null
  task: TaskViewModel | null
}

export function useRetryActions() {
  const [retryDialog, setRetryDialog] = useState<RetryDialogState>({
    open: false,
    action: null,
    task: null,
  })
  const [retryBusy, setRetryBusy] = useState(false)

  const requestRetryAction = useCallback((action: RetryAction, task: TaskViewModel) => {
    setRetryDialog({ open: true, action, task })
  }, [])

  const closeRetryDialog = useCallback(() => {
    if (retryBusy) return
    setRetryDialog({ open: false, action: null, task: null })
  }, [retryBusy])

  const confirmRetryAction = useCallback(
    async (prompt: string) => {
      if (!retryDialog.task || !retryDialog.action) return
      setRetryBusy(true)
      try {
        const taskId = retryDialog.task.id
        switch (retryDialog.action) {
          case 'retry':
            await window.orbit.retryTask({ taskId })
            break
          case 'resume':
            await window.orbit.resumeTask({ taskId, prompt })
            break
          case 'revise':
            await window.orbit.reviseTask({ taskId, prompt })
            break
        }
        setRetryDialog({ open: false, action: null, task: null })
      } finally {
        setRetryBusy(false)
      }
    },
    [retryDialog.action, retryDialog.task],
  )

  const deleteTask = useCallback(async (taskId: string) => {
    await window.orbit.deleteTask({ taskId })
  }, [])

  return {
    retryDialog,
    retryBusy,
    requestRetryAction,
    closeRetryDialog,
    confirmRetryAction,
    deleteTask,
  }
}
