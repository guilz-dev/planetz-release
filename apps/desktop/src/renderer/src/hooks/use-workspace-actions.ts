import type { FacetKind } from '@planetz/shared'
import { useCallback } from 'react'
import { resolveComposerWorkflowName } from '../lib/composer-workflow-selection.js'

export function useWorkspaceActions(options: {
  selectedWorkflow: string
  setSelectedWorkflow: (name: string) => void
  watchRunning: boolean
}) {
  const { selectedWorkflow, setSelectedWorkflow, watchRunning } = options

  const refreshWorkflows = useCallback(async () => {
    const list = await window.orbit.listWorkflows()
    if (list.length > 0 && !list.find((w) => w.name === selectedWorkflow)) {
      setSelectedWorkflow(resolveComposerWorkflowName(list, selectedWorkflow))
    }
  }, [selectedWorkflow, setSelectedWorkflow])

  const toggleWatch = useCallback(async () => {
    if (watchRunning) {
      await window.orbit.stopWatch()
    } else {
      await window.orbit.startWatch()
    }
  }, [watchRunning])

  const listFacetUsages = useCallback(
    (input: { kind: FacetKind; key: string }) => window.orbit.listFacetUsages(input),
    [],
  )

  return {
    refreshWorkflows,
    toggleWatch,
    listFacetUsages,
  }
}
