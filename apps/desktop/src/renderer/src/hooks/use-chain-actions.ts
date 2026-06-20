import type { ChainEdge, TaskViewModel } from '@planetz/shared'
import { chainEdgeKey } from '@planetz/shared'
import { useCallback, useState } from 'react'

interface ChainDialogState {
  open: boolean
  origin: TaskViewModel | null
}

export function useChainActions() {
  const [chainDialog, setChainDialog] = useState<ChainDialogState>({ open: false, origin: null })
  const [chainBusy, setChainBusy] = useState(false)
  const [chainMaterializeBusy, setChainMaterializeBusy] = useState(false)
  const [chainMaterializeWarning, setChainMaterializeWarning] = useState<string | null>(null)

  const requestCreateChain = useCallback((origin: TaskViewModel) => {
    setChainDialog({ open: true, origin })
  }, [])

  const closeChainDialog = useCallback(() => {
    if (chainBusy) return
    setChainDialog({ open: false, origin: null })
  }, [chainBusy])

  const confirmChainCreate = useCallback(
    async (input: {
      title: string
      body: string
      workflow: string
      mode: 'branch_handoff' | 'merge_then_continue'
      sourceBranch?: string
      baseBranch?: string
    }) => {
      if (!chainDialog.origin) return
      setChainBusy(true)
      try {
        await window.orbit.createChainTask({
          fromTaskId: chainDialog.origin.id,
          title: input.title,
          body: input.body,
          workflow: input.workflow,
          mode: input.mode,
          sourceBranch: input.sourceBranch,
          baseBranch: input.baseBranch,
          chainId: chainDialog.origin.chainId,
        })
        setChainDialog({ open: false, origin: null })
      } finally {
        setChainBusy(false)
      }
    },
    [chainDialog.origin],
  )

  const materializeChain = useCallback(async (input: { chainId: string; fromTaskId: string }) => {
    setChainMaterializeBusy(true)
    setChainMaterializeWarning(null)
    try {
      const result = await window.orbit.materializeChainEdge(input)
      if (result.warnings?.length) {
        setChainMaterializeWarning(result.warnings.join(' '))
      }
    } finally {
      setChainMaterializeBusy(false)
    }
  }, [])

  const unlinkChainEdge = useCallback(async (chainId: string, edge: ChainEdge) => {
    await window.orbit.deleteChain({
      chainId,
      edgeKey: chainEdgeKey(edge),
    })
  }, [])

  return {
    chainDialog,
    chainBusy,
    chainMaterializeBusy,
    chainMaterializeWarning,
    requestCreateChain,
    closeChainDialog,
    confirmChainCreate,
    materializeChain,
    unlinkChainEdge,
  }
}
