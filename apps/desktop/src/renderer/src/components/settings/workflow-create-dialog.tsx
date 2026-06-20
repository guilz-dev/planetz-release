import {
  ORBIT_DISPLAY_NAME,
  planetzWorkflowsDirRelPath,
  SPEC_DRIVEN_WORKFLOW_NAME,
  type WorkflowDiagnostic,
  type WorkflowSummary,
} from '@planetz/shared'
import { AlertCircle, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Dialog } from '../ui/dialog'
import { Field, Input } from '../ui/input'
import { Select } from '../ui/select'
import {
  DEFAULT_SCAFFOLD_MAX_STEPS,
  draftFromImportedYaml,
  loadTemplateDraft,
  personasSummary,
  previewDraftForImportYaml,
  previewDraftForTemplate,
  stepSummaryLine,
  type WorkflowCreateTemplate,
} from './workflow-create-utils'
import type { WorkflowDraft } from './workflow-draft-types.js'
import {
  isDuplicateProjectWorkflowName,
  suggestDefaultWorkflowName,
  validateInitialStep,
  validateWorkflowName,
} from './workflow-name-utils'

export interface WorkflowCreateResult {
  draft: WorkflowDraft
  /** When set, workflow YAML was imported from this path (facet copy may follow on save). */
  importSourcePath?: string
  /** Materialize the canonical spec-driven workflow via main installer (fixed name). */
  installSpecDriven?: boolean
}

interface WorkflowCreateDialogProps {
  open: boolean
  workflows: WorkflowSummary[]
  onClose: () => void
  onConfirm: (result: WorkflowCreateResult) => void | Promise<void>
}

const TEMPLATE_OPTIONS: Array<{ value: WorkflowCreateTemplate; label: string }> = [
  { value: 'default', label: 'From builtin: default' },
  { value: 'minimal', label: 'From builtin: minimal' },
  { value: 'spec-driven', label: 'From builtin: spec-driven' },
  { value: 'scaffold', label: 'Empty scaffold' },
]

export function WorkflowCreateDialog({
  open,
  workflows,
  onClose,
  onConfirm,
}: WorkflowCreateDialogProps) {
  const [template, setTemplate] = useState<WorkflowCreateTemplate>('default')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [initialStepError, setInitialStepError] = useState<string | null>(null)
  const [scaffoldInitialStep, setScaffoldInitialStep] = useState('')
  const [scaffoldMaxSteps, setScaffoldMaxSteps] = useState(DEFAULT_SCAFFOLD_MAX_STEPS)
  const [preview, setPreview] = useState<WorkflowDraft | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importPath, setImportPath] = useState<string | null>(null)
  const [importYaml, setImportYaml] = useState<string | null>(null)
  const [importWarning, setImportWarning] = useState<string | null>(null)
  const [importDoctor, setImportDoctor] = useState<WorkflowDiagnostic[] | null>(null)
  const [importChecking, setImportChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setTemplate('default')
    setName(suggestDefaultWorkflowName(workflows))
    setNameError(null)
    setInitialStepError(null)
    setScaffoldInitialStep('')
    setScaffoldMaxSteps(DEFAULT_SCAFFOLD_MAX_STEPS)
    setPreview(null)
    setImportPath(null)
    setImportYaml(null)
    setImportWarning(null)
    setImportDoctor(null)
    setImportChecking(false)
    setSubmitting(false)
  }, [workflows])

  useEffect(() => {
    if (!open) return
    resetForm()
  }, [open, resetForm])

  useEffect(() => {
    if (!open) return
    if (importYaml) {
      setPreviewLoading(true)
      void previewDraftForImportYaml(importYaml)
        .then(setPreview)
        .finally(() => setPreviewLoading(false))
      return
    }
    setPreviewLoading(true)
    const scaffoldStep = template === 'scaffold' ? scaffoldInitialStep : undefined
    const maxSteps = template === 'scaffold' ? scaffoldMaxSteps : undefined
    void previewDraftForTemplate(template, scaffoldStep, maxSteps)
      .then(setPreview)
      .finally(() => setPreviewLoading(false))
  }, [open, template, importYaml, scaffoldInitialStep, scaffoldMaxSteps])

  function clearImport() {
    setImportPath(null)
    setImportYaml(null)
    setImportWarning(null)
    setImportDoctor(null)
  }

  function selectTemplate(next: WorkflowCreateTemplate) {
    clearImport()
    const previous = template
    setTemplate(next)
    setInitialStepError(null)
    if (next === 'spec-driven') {
      setName(SPEC_DRIVEN_WORKFLOW_NAME)
    } else if (previous === 'spec-driven') {
      setName(suggestDefaultWorkflowName(workflows))
    }
    if (next === 'scaffold') {
      setScaffoldInitialStep('')
      setScaffoldMaxSteps(DEFAULT_SCAFFOLD_MAX_STEPS)
    }
  }

  const isScaffoldTemplate = !importYaml && template === 'scaffold'
  const isSpecDrivenTemplate = !importYaml && template === 'spec-driven'

  async function handlePickImport() {
    setImportWarning(null)
    setImportDoctor(null)
    setImportChecking(true)
    try {
      const picked = await window.orbit.pickWorkflowImportYaml()
      if (picked.canceled) return
      const doctor = await window.orbit.validateWorkflow({
        nameOrPath: picked.path,
        yaml: picked.yaml,
      })
      const errors = doctor.filter((d) => d.level === 'error')
      if (errors.length > 0) {
        setImportPath(picked.path)
        setImportYaml(null)
        setImportDoctor(doctor)
        setImportWarning(
          errors.map((e) => e.message).join('\n') ||
            `${ORBIT_DISPLAY_NAME} workflow doctor reported errors. Fix the YAML before importing.`,
        )
        return
      }
      setImportPath(picked.path)
      setImportYaml(picked.yaml)
      setImportDoctor(doctor.filter((d) => d.level !== 'error'))
      const parsed = await previewDraftForImportYaml(picked.yaml)
      if (parsed.name && !name.trim()) {
        setName(parsed.name)
      }
    } catch (err) {
      setImportWarning(err instanceof Error ? err.message : String(err))
    } finally {
      setImportChecking(false)
    }
  }

  async function handleSubmit() {
    const formatError = validateWorkflowName(name)
    if (formatError) {
      setNameError(formatError)
      return
    }
    const normalized = isSpecDrivenTemplate ? SPEC_DRIVEN_WORKFLOW_NAME : name.trim()
    if (isDuplicateProjectWorkflowName(normalized, workflows)) {
      setNameError('A project workflow with this name already exists.')
      return
    }
    if (importPath && !importYaml) {
      setNameError(null)
      setImportWarning('Import a valid workflow YAML before creating.')
      return
    }

    setSubmitting(true)
    setNameError(null)
    setInitialStepError(null)
    try {
      let draft: WorkflowDraft
      if (importYaml) {
        draft = draftFromImportedYaml(importYaml, normalized)
      } else {
        draft = await loadTemplateDraft(
          template,
          normalized,
          template === 'scaffold' ? scaffoldInitialStep : undefined,
          template === 'scaffold' ? scaffoldMaxSteps : undefined,
        )
      }
      if (isScaffoldTemplate) {
        const stepError = validateInitialStep(draft)
        if (stepError) {
          setInitialStepError(stepError)
          return
        }
      }
      await onConfirm({
        draft,
        importSourcePath: importYaml ? (importPath ?? undefined) : undefined,
        installSpecDriven: isSpecDrivenTemplate,
      })
    } catch (err) {
      setNameError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const maxStepsDisplay = isScaffoldTemplate ? scaffoldMaxSteps : (preview?.maxSteps ?? '—')
  const stepSummary = preview ? stepSummaryLine(preview) : '—'
  const personaLine = preview ? personasSummary(preview) : '—'
  const stepCount = preview?.steps.length ?? 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create workflow"
      description="Choose a template or import YAML, then open the editor."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create workflow'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Create from template
          </p>
          <div className="flex flex-col gap-2 text-xs">
            {TEMPLATE_OPTIONS.map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="wf-create-template"
                  checked={!importYaml && template === value}
                  onChange={() => selectTemplate(value)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leading={<FolderOpen size={12} />}
              onClick={() => void handlePickImport()}
              disabled={importChecking}
            >
              {importChecking ? 'Checking…' : 'From workflow folder…'}
            </Button>
            {importPath ? (
              <span className="min-w-0 truncate font-mono text-[11px] text-[var(--color-muted)]">
                {importPath}
              </span>
            ) : null}
          </div>
          {importWarning ? (
            <div
              role="alert"
              className="mt-2 flex gap-2 rounded-md border border-[var(--color-status-failed)]/40 bg-[var(--color-status-failed-soft)]/30 px-3 py-2 text-xs text-[var(--color-status-failed)]"
            >
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="min-w-0 whitespace-pre-wrap">{importWarning}</div>
            </div>
          ) : null}
          {importYaml && importDoctor && importDoctor.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-[11px] text-[var(--color-status-exceeded)]">
              {importDoctor.map((d, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: doctor lines lack stable ids
                <li key={i}>{d.message}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <Field
          label="Workflow name"
          hint={
            isSpecDrivenTemplate
              ? `Fixed name for auto routing metadata · saved under ${planetzWorkflowsDirRelPath()}/`
              : `Required · kebab-case · saved under ${planetzWorkflowsDirRelPath()}/`
          }
        >
          <Input
            autoFocus={!isSpecDrivenTemplate}
            placeholder="my-workflow"
            value={isSpecDrivenTemplate ? SPEC_DRIVEN_WORKFLOW_NAME : name}
            disabled={isSpecDrivenTemplate}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </Field>
        {nameError ? (
          <p className="-mt-2 text-xs text-[var(--color-status-failed)]">{nameError}</p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Field
              label="Initial step"
              hint={isScaffoldTemplate ? 'Required for Empty scaffold.' : undefined}
            >
              {isScaffoldTemplate ? (
                <Select
                  fullWidth
                  value={scaffoldInitialStep}
                  onChange={(e) => {
                    setScaffoldInitialStep(e.target.value)
                    setInitialStepError(null)
                  }}
                >
                  <option value="">(not set)</option>
                  {(preview?.steps ?? []).map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  readOnly
                  value={preview?.initialStep ?? ''}
                  placeholder="—"
                  className="opacity-80"
                />
              )}
            </Field>
            {initialStepError ? (
              <p className="text-xs text-[var(--color-status-failed)]">{initialStepError}</p>
            ) : null}
          </div>
          <Field label="Max steps" hint={isScaffoldTemplate ? 'Loop cap (default 10)' : undefined}>
            {isScaffoldTemplate ? (
              <Input
                type="number"
                min={1}
                max={50}
                value={scaffoldMaxSteps}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next) && next >= 1) {
                    setScaffoldMaxSteps(Math.min(50, Math.floor(next)))
                  }
                }}
              />
            ) : (
              <Input readOnly value={String(maxStepsDisplay)} className="opacity-80" />
            )}
          </Field>
        </div>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Step summary
          </p>
          {previewLoading ? (
            <p className="text-xs text-[var(--color-muted)]">Loading preview…</p>
          ) : (
            <>
              <p className="text-xs text-[var(--color-text)]">{stepSummary}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {stepCount} steps · personas: {personaLine}
              </p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
