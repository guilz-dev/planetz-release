import { useCallback, useRef, useState } from 'react'
import type { ConfirmDialogRequest } from '../../hooks/use-confirm-dialog.js'
import { findRuleReferences, renameStepInDraft } from './workflow-diagnostics.js'
import type { WorkflowDraft } from './workflow-draft-types.js'

let _stepCounter = 0

function newStepId(): string {
  _stepCounter += 1
  return `step-new-${_stepCounter}`
}

interface UseWorkflowStepEditingParams {
  draft: WorkflowDraft | null
  setDraft: (next: WorkflowDraft | null) => void
  selectedStepId: string | null
  setSelectedStepId: (id: string | null) => void
  requestConfirm: (payload: ConfirmDialogRequest | string) => Promise<boolean>
}

export function useWorkflowStepEditing({
  draft,
  setDraft,
  selectedStepId,
  setSelectedStepId,
  requestConfirm,
}: UseWorkflowStepEditingParams) {
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const draggingStepIdRef = useRef<string | null>(null)
  const dropTargetIdRef = useRef<string | null>(null)

  const updateStepAt = useCallback(
    (index: number, next: WorkflowDraft['steps'][number]) => {
      if (!draft) return
      setDraft({
        ...draft,
        steps: draft.steps.map((s, i) => (i === index ? next : s)),
      })
    },
    [draft, setDraft],
  )

  const renameStep = useCallback(
    async (oldName: string, newName: string) => {
      if (!draft || oldName === newName) return
      const refs = findRuleReferences(draft, oldName)
      if (refs > 0) {
        const ok = await requestConfirm(
          `${refs} rule(s) reference "${oldName}" in rules.next. Update them too?\n\nOK = update references\nCancel = rename only (references will dangle)`,
        )
        if (ok) {
          setDraft(renameStepInDraft(draft, oldName, newName))
          return
        }
      }
      setDraft({
        ...draft,
        steps: draft.steps.map((s) => (s.name === oldName ? { ...s, name: newName } : s)),
      })
    },
    [draft, requestConfirm, setDraft],
  )

  const addStep = useCallback(() => {
    if (!draft) return
    const baseName = `step-${draft.steps.length + 1}`
    const id = newStepId()
    setDraft({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id,
          name: baseName,
          rules: [],
          raw: {},
        },
      ],
    })
    setSelectedStepId(id)
  }, [draft, setDraft, setSelectedStepId])

  const reorderStepById = useCallback(
    (sourceId: string, targetId: string) => {
      if (!draft || sourceId === targetId) return
      const from = draft.steps.findIndex((s) => s.id === sourceId)
      const to = draft.steps.findIndex((s) => s.id === targetId)
      if (from < 0 || to < 0) return
      const next = [...draft.steps]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      setDraft({ ...draft, steps: next })
    },
    [draft, setDraft],
  )

  const beginStepDrag = useCallback((id: string) => {
    draggingStepIdRef.current = id
    setDraggingStepId(id)
  }, [])

  const hoverStepDropTarget = useCallback((id: string) => {
    dropTargetIdRef.current = id
    setDropTargetId(id)
  }, [])

  const clearStepDragState = useCallback(() => {
    draggingStepIdRef.current = null
    dropTargetIdRef.current = null
    setDraggingStepId(null)
    setDropTargetId(null)
  }, [])

  const clearDropTarget = useCallback(() => {
    dropTargetIdRef.current = null
    setDropTargetId(null)
  }, [])

  const commitStepReorderFromDrag = useCallback(() => {
    const source = draggingStepIdRef.current
    const target = dropTargetIdRef.current
    if (source && target && source !== target) {
      reorderStepById(source, target)
    }
    clearStepDragState()
  }, [clearStepDragState, reorderStepById])

  const removeStep = useCallback(
    async (index: number) => {
      if (!draft) return
      const s = draft.steps[index]
      if (!(await requestConfirm(`Delete step "${s.name}"?`))) return
      const removedId = s.id
      setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })
      if (selectedStepId === removedId) {
        const nextSel = draft.steps[index + 1]?.id ?? draft.steps[index - 1]?.id ?? null
        setSelectedStepId(nextSel)
      }
    },
    [draft, requestConfirm, selectedStepId, setDraft, setSelectedStepId],
  )

  return {
    draggingStepId,
    dropTargetId,
    updateStepAt,
    renameStep,
    addStep,
    reorderStepById,
    beginStepDrag,
    hoverStepDropTarget,
    clearStepDragState,
    clearDropTarget,
    commitStepReorderFromDrag,
    removeStep,
  }
}
