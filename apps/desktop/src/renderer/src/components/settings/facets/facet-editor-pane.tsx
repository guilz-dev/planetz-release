import { AlertCircle, ExternalLink, Link2, Lock, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../ui/cn'
import { Field, Input, Textarea } from '../../ui/input'
import { Tooltip } from '../../ui/tooltip'
import type { FacetListingSource } from '../workflow-facets-build-items.js'
import { type FacetKindDef, facetKindDef } from './facet-kind-defs'
import { facetManagedPath } from './facet-path'
import { PersonaOutlinePreview, parsePersonaOutline } from './persona-outline-preview'

export type FacetEditorMode = 'master' | 'reference'

export interface FacetEditorItem {
  kind: FacetKindDef['kind']
  key: string
  source: 'project' | 'builtin'
  listingSource?: FacetListingSource
  content: string
  stepReferences?: number
  workflowReferences?: number
  referencingStepNames?: string[]
  keyEditable?: boolean
  contentEditable?: boolean
}

interface FacetEditorPaneProps {
  item: FacetEditorItem
  mode: FacetEditorMode
  busy?: boolean
  onChange?: (patch: { key?: string; content?: string }) => void
  onRemove?: () => void
  onOverride?: () => void
  onEditInFacets?: () => void
  onAssignOnStepsTab?: () => void
  onDuplicate?: () => void
  /** When provided, render a manual-save footer below the content editor. */
  onSave?: () => void
  /** Whether there are unsaved edits to persist (drives the Save button + hint). */
  dirty?: boolean
  /** Whether a save is currently in flight. */
  saving?: boolean
}

export function FacetEditorPane({
  item,
  mode,
  busy = false,
  onChange,
  onRemove,
  onOverride,
  onEditInFacets,
  onAssignOnStepsTab,
  onDuplicate,
  onSave,
  dirty = false,
  saving = false,
}: FacetEditorPaneProps) {
  const kindDef = facetKindDef(item.kind)
  const isBuiltin = item.source === 'builtin'
  const isReference = mode === 'reference'
  const contentEditable = item.contentEditable ?? (!isBuiltin && !isReference)
  const keyEditable = item.keyEditable ?? (!isBuiltin && !isReference)
  const deleteBlocked =
    mode !== 'master' && ((item.stepReferences ?? 0) > 0 || (item.workflowReferences ?? 0) > 0)
  const referenced = (item.stepReferences ?? 0) > 0 || (item.workflowReferences ?? 0) > 0
  const isPersona = item.kind === 'personas'
  const path = facetManagedPath(item.kind, item.key || 'facet')
  const outline = isPersona ? parsePersonaOutline(item.content) : null

  return (
    <div className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]/40 px-3 py-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-muted-strong)]">
          {kindDef.icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
            {kindDef.label} — {item.key || '(new)'}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            {kindDef.question}
          </span>
        </div>

        {isBuiltin ? (
          <Tooltip
            side="bottom"
            wide
            label="Provided by orbit builtins (resources/orbit/builtins/…). Read-only here — click Override to create a project-level editable copy."
          >
            <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)]/50 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted-strong)]">
              <Lock size={10} /> Builtin
            </span>
          </Tooltip>
        ) : null}

        {(item.stepReferences ?? 0) > 0 ? (
          <Tooltip
            side="bottom"
            label={
              item.referencingStepNames && item.referencingStepNames.length > 0
                ? `Referenced by: ${item.referencingStepNames.join(', ')}`
                : `Referenced by ${item.stepReferences} step${item.stepReferences === 1 ? '' : 's'}`
            }
          >
            <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted-strong)]">
              <Link2 size={10} /> {item.stepReferences} steps
            </span>
          </Tooltip>
        ) : null}

        {item.listingSource ? (
          <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)]/30 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted-strong)]">
            {item.listingSource === 'workflowMap'
              ? 'In workflow'
              : item.listingSource === 'stepRef'
                ? 'Step ref'
                : 'Bundled'}
          </span>
        ) : null}

        {(item.workflowReferences ?? 0) > 0 ? (
          <Tooltip
            side="bottom"
            label={`Used by ${item.workflowReferences} workflow${item.workflowReferences === 1 ? '' : 's'}`}
          >
            <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted-strong)]">
              <Link2 size={10} /> {item.workflowReferences} workflows
            </span>
          </Tooltip>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {isReference && onAssignOnStepsTab ? (
            <Button variant="secondary" size="sm" onClick={onAssignOnStepsTab}>
              Assign on Steps tab
            </Button>
          ) : null}
          {isReference && onEditInFacets ? (
            <Button
              variant="secondary"
              size="sm"
              leading={<ExternalLink size={11} />}
              onClick={onEditInFacets}
            >
              Edit in Facets
            </Button>
          ) : null}
          {isBuiltin && onOverride ? (
            <Button
              variant="secondary"
              size="sm"
              leading={<Plus size={11} />}
              onClick={onOverride}
              disabled={busy}
            >
              Override
            </Button>
          ) : null}
          {!isBuiltin && mode === 'master' && onDuplicate ? (
            <Button variant="ghost" size="sm" onClick={onDuplicate} disabled={busy}>
              Duplicate
            </Button>
          ) : null}
          {!isBuiltin && onRemove ? (
            <Tooltip
              side="bottom"
              label={
                deleteBlocked
                  ? `Cannot delete — still referenced. Remove references first.`
                  : referenced && mode === 'master'
                    ? `Referenced by ${item.workflowReferences ?? 0} workflow(s) and ${item.stepReferences ?? 0} step(s). Deleting removes the master file only.`
                    : 'Delete this facet'
              }
            >
              <span>
                <Button
                  variant="ghost"
                  size="sm"
                  leading={<Trash2 size={11} />}
                  onClick={onRemove}
                  disabled={deleteBlocked || busy}
                >
                  Delete
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </div>
      </header>

      {isReference ? (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-accent-soft)]/20 px-3 py-1.5">
          <p className="text-[11px] text-[var(--color-muted-strong)]">
            Facet body editing lives in Settings → Facets. This tab defines workflow keys and paths;
            assign which key each step uses on the Steps tab.
          </p>
        </div>
      ) : null}

      <div className="border-b border-[var(--color-border)] bg-[var(--color-panel)]/20 px-3 py-1.5">
        <p className="text-[11px] text-[var(--color-muted-strong)]">{kindDef.intent}</p>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Field
            label="Key (kebab-case)"
            hint={
              isBuiltin
                ? 'Read-only — defined by takt builtins.'
                : keyEditable
                  ? 'Used by steps to reference this facet.'
                  : 'Reference key in this workflow.'
            }
          >
            <Input
              value={item.key}
              disabled={!keyEditable}
              placeholder="e.g. coder, coding, architecture"
              onChange={(e) => onChange?.({ key: e.target.value })}
            />
          </Field>
          <Field label="Managed path" hint="Saved location relative to the workflow file.">
            <Input value={path} disabled readOnly />
          </Field>
        </div>

        <div
          className={cn(
            'grid gap-3',
            isPersona ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]' : 'grid-cols-1',
          )}
        >
          <Field
            label="Content (Markdown)"
            notice={
              onSave && contentEditable && dirty ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-2 py-1 text-[11px] font-medium text-[var(--color-warning)]">
                  <AlertCircle size={12} className="shrink-0" />
                  Unsaved changes — click Save to apply.
                </span>
              ) : null
            }
            hint={
              isBuiltin
                ? 'Builtin content ships with takt and cannot be edited here.'
                : !contentEditable
                  ? 'Edit in Settings → Facets.'
                  : isPersona
                    ? 'Identity, role boundaries, and behavioral principles. Avoid step-specific procedures.'
                    : undefined
            }
          >
            <Textarea
              rows={14}
              value={item.content}
              disabled={!contentEditable || busy}
              placeholder={
                isBuiltin
                  ? '# (builtin)\n\nThis facet ships with takt. Click Override to create an editable copy.'
                  : isPersona
                    ? "# Role title\n\nShort identity description.\n\n## Role Boundaries\n\n**Do:**\n- ...\n\n**Don't:**\n- ...\n\n## Behavioral Principles\n\n- ..."
                    : 'Write the facet body in Markdown…'
              }
              onChange={(e) => onChange?.({ content: e.target.value })}
              className={cn('text-[12px]', isPersona && 'h-80 resize-none')}
            />
          </Field>

          {isPersona && outline ? (
            <PersonaOutlinePreview outline={outline} className="h-80 overflow-y-auto" />
          ) : null}
        </div>

        {onSave && contentEditable ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-3">
            <Button
              variant="primary"
              size="sm"
              leading={<Save size={13} />}
              disabled={!dirty || busy}
              loading={saving}
              onClick={onSave}
            >
              Save facet
            </Button>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-[11px]',
                dirty ? 'font-medium text-[var(--color-warning)]' : 'text-[var(--color-muted)]',
              )}
            >
              <AlertCircle size={12} className="shrink-0" />
              {dirty
                ? 'Unsaved changes — not saved automatically. Click Save to apply.'
                : 'Edits here are not saved automatically. Click Save to apply changes.'}
            </span>
          </div>
        ) : null}

        {referenced && !deleteBlocked ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/30 px-2 py-1.5 text-[11px] text-[var(--color-muted-strong)]">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            <span>
              Used by {item.workflowReferences ?? 0} workflow
              {(item.workflowReferences ?? 0) === 1 ? '' : 's'} / {item.stepReferences ?? 0} step
              {(item.stepReferences ?? 0) === 1 ? '' : 's'}. You can edit content; delete removes
              the project master file but leaves workflow references until you update them.
            </span>
          </div>
        ) : null}

        {deleteBlocked && !isBuiltin ? (
          <div className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/30 px-2 py-1.5 text-[11px] text-[var(--color-muted-strong)]">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            <span>
              Still referenced — you can edit content, but deletion is disabled until references are
              removed.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
