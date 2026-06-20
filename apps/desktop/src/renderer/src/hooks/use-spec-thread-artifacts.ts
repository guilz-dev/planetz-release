import type { TaskReportArtifact, TaskViewModel } from '@planetz/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { filterSpecArtifacts, pickLatestCompletedTaskId } from '../lib/spec-artifact-filters'

export function useSpecThreadArtifacts(
  taskIds: readonly string[],
  tasks: readonly TaskViewModel[],
) {
  const { t } = useI18n()
  const artifactSourceTaskId = useMemo(
    () => pickLatestCompletedTaskId(taskIds, tasks),
    [taskIds, tasks],
  )
  const [artifactsLoading, setArtifactsLoading] = useState(false)
  const [artifactsError, setArtifactsError] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<TaskReportArtifact[]>([])
  const [artifactTaskId, setArtifactTaskId] = useState<string | null>(null)

  const reloadArtifacts = useCallback(
    async (taskId: string | null) => {
      if (!taskId) {
        setArtifacts([])
        setArtifactTaskId(null)
        setArtifactsError(null)
        return
      }
      setArtifactsLoading(true)
      setArtifactsError(null)
      try {
        const bundle = await window.orbit.getTaskResult({ taskId })
        setArtifactTaskId(taskId)
        setArtifacts(filterSpecArtifacts(bundle.reports))
      } catch (cause) {
        setArtifactsError(
          cause instanceof Error ? cause.message : t('specStudio.artifactsLoadFailed'),
        )
        setArtifacts([])
        setArtifactTaskId(taskId)
      } finally {
        setArtifactsLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void reloadArtifacts(artifactSourceTaskId)
  }, [artifactSourceTaskId, reloadArtifacts])

  return {
    artifacts,
    artifactsLoading,
    artifactsError,
    artifactTaskId,
    reloadArtifacts,
  }
}
