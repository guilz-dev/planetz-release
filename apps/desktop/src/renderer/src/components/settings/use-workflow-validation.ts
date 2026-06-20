import type { WorkflowDiagnostic } from '@planetz/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { routeDiagnosticsToSteps } from './workflow-diagnostics.js'
import type { WorkflowDraft } from './workflow-draft-types.js'

/** Debounce before calling orbit doctor after draft/yaml changes. */
export const WORKFLOW_VALIDATION_DEBOUNCE_MS = 1500

interface UseWorkflowValidationParams {
  view: 'catalog' | 'editor'
  draft: WorkflowDraft | null
  selected: string
  currentYaml: string
}

export function useWorkflowValidation({
  view,
  draft,
  selected,
  currentYaml,
}: UseWorkflowValidationParams) {
  const [diagnostics, setDiagnostics] = useState<WorkflowDiagnostic[] | null>(null)
  const [validating, setValidating] = useState(false)
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runValidate = useCallback(async () => {
    if (!draft) return
    setValidating(true)
    try {
      const result = await window.orbit.validateWorkflow({
        nameOrPath: draft.name || selected,
        yaml: currentYaml,
      })
      setDiagnostics(result)
    } catch {
      // doctor may be unavailable in mock / offline dev
    } finally {
      setValidating(false)
    }
  }, [currentYaml, draft, selected])

  useEffect(() => {
    if (view !== 'editor' || !draft) return
    if (validateTimer.current) clearTimeout(validateTimer.current)
    validateTimer.current = setTimeout(() => {
      void runValidate()
    }, WORKFLOW_VALIDATION_DEBOUNCE_MS)
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current)
    }
  }, [draft, view, runValidate])

  const routedDiagnostics = useMemo(
    () => (draft && diagnostics ? routeDiagnosticsToSteps(draft, diagnostics) : null),
    [draft, diagnostics],
  )

  const hasDoctorError = (diagnostics ?? []).some((d) => d.level === 'error')

  return {
    diagnostics,
    setDiagnostics,
    validating,
    runValidate,
    routedDiagnostics,
    hasDoctorError,
  }
}
