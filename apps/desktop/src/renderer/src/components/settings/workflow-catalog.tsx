import {
  filterWorkflowSummaries,
  planetzWorkflowsDirRelPath,
  type WorkflowSummary,
} from '@planetz/shared'
import { Code2, Copy, CopyPlus, Edit3, FileDiff, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Input } from '../ui/input'
import { StatusDot } from '../ui/status-dot'
import { Toggle } from '../ui/toggle'

interface WorkflowCatalogProps {
  workflows: WorkflowSummary[]
  builtinWorkflowCategoryOrder?: string[]
  /** When set, only workflows whose names appear in this set are listed. */
  workflowNameFilter?: ReadonlySet<string> | null
  workflowFilterLabel?: string | null
  onClearWorkflowFilter?: () => void
  onOpen: (name: string) => void
  onOpenYaml: (name: string) => void
  onCopyToProject: (name: string) => Promise<void> | void
  autoEligibleWorkflowNames?: readonly string[]
  onToggleAutoEligible?: (name: string, enabled: boolean) => void
  onDuplicate: (name: string) => void
  onDiff: (name: string) => void
  onCreateNew: () => void
  hideHeader?: boolean
  initialQuery?: string
}

const SOURCE_TONE: Record<WorkflowSummary['source'], 'completed' | 'accent' | 'neutral'> = {
  project: 'completed',
  user: 'accent',
  builtin: 'neutral',
  path: 'neutral',
}

function editableBadge(wf: WorkflowSummary): {
  label: string
  tone: 'completed' | 'exceeded' | 'failed'
} {
  const hasError = wf.diagnostics.some((d) => d.level === 'error')
  if (hasError) return { label: 'doctor errors', tone: 'failed' }
  if (wf.formMode === 'partial') return { label: 'Partial', tone: 'exceeded' }
  if (wf.formEditable === false) return { label: 'YAML-only', tone: 'exceeded' }
  if (wf.source === 'builtin' && !wf.isOverridden) {
    return { label: 'form-editable', tone: 'completed' }
  }
  if (wf.formEditable === true) return { label: 'form-editable', tone: 'completed' }
  const hasWarn = wf.diagnostics.some((d) => d.level === 'warn')
  if (hasWarn) return { label: 'review needed', tone: 'exceeded' }
  return { label: 'form-editable', tone: 'completed' }
}

function groupBuiltinsByCategory(
  items: WorkflowSummary[],
  categoryOrder: string[],
): Array<{ title: string; items: WorkflowSummary[] }> {
  const groups = new Map<string, WorkflowSummary[]>()
  for (const category of categoryOrder) {
    groups.set(category, [])
  }
  groups.set('Uncategorized', [])

  for (const workflow of items) {
    const categories = workflow.categories ?? []
    if (categories.length === 0) {
      groups.get('Uncategorized')?.push(workflow)
      continue
    }
    for (const category of categories) {
      if (!groups.has(category)) {
        groups.set(category, [])
      }
      groups.get(category)?.push(workflow)
    }
  }

  const ordered: Array<{ title: string; items: WorkflowSummary[] }> = []
  const seenCategories = new Set<string>()
  for (const category of categoryOrder) {
    seenCategories.add(category)
    const groupItems = groups.get(category) ?? []
    if (groupItems.length > 0) {
      ordered.push({ title: category, items: groupItems })
    }
  }
  for (const [title, groupItems] of groups) {
    if (title === 'Uncategorized' || seenCategories.has(title)) continue
    if (groupItems.length > 0) {
      ordered.push({ title, items: groupItems })
    }
  }
  const uncategorized = groups.get('Uncategorized') ?? []
  if (uncategorized.length > 0) {
    ordered.push({ title: 'Uncategorized', items: uncategorized })
  }
  return ordered
}

export function WorkflowCatalog({
  workflows,
  builtinWorkflowCategoryOrder = [],
  workflowNameFilter = null,
  workflowFilterLabel = null,
  onClearWorkflowFilter,
  onOpen,
  onOpenYaml,
  onCopyToProject,
  autoEligibleWorkflowNames = [],
  onToggleAutoEligible,
  onDuplicate,
  onDiff,
  onCreateNew,
  hideHeader = false,
  initialQuery = '',
}: WorkflowCatalogProps) {
  const { t } = useI18n()
  const [q, setQ] = useState(initialQuery)
  const autoEligibleSet = useMemo(
    () => new Set(autoEligibleWorkflowNames.map((name) => name.trim())),
    [autoEligibleWorkflowNames],
  )

  useEffect(() => {
    if (hideHeader) setQ(initialQuery)
  }, [hideHeader, initialQuery])

  const grouped = useMemo(() => {
    let items = filterWorkflowSummaries(q, workflows)
    if (workflowNameFilter && workflowNameFilter.size > 0) {
      items = items.filter((w) => workflowNameFilter.has(w.name))
    }
    return {
      project: items.filter((w) => w.source === 'project'),
      user: items.filter((w) => w.source === 'user'),
      builtin: items.filter((w) => w.source === 'builtin'),
      path: items.filter((w) => w.source === 'path'),
    }
  }, [q, workflows, workflowNameFilter])

  const builtinGroups = useMemo(
    () => groupBuiltinsByCategory(grouped.builtin, builtinWorkflowCategoryOrder),
    [grouped.builtin, builtinWorkflowCategoryOrder],
  )

  const uniqueBuiltinCount = useMemo(
    () => new Set(grouped.builtin.map((workflow) => workflow.name)).size,
    [grouped.builtin],
  )

  function renderWorkflowCard(wf: WorkflowSummary) {
    const editable = editableBadge(wf)
    const yamlOnly = wf.formEditable === false
    const canToggleAuto = wf.source !== 'builtin' && typeof onToggleAutoEligible === 'function'
    const autoEligible = autoEligibleSet.has(wf.name)
    return (
      <article
        key={`${wf.source}:${wf.name}:${wf.categories?.join(',') ?? ''}`}
        className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3 transition-colors hover:border-[var(--color-border-strong)]"
      >
        <header className="flex items-center gap-2">
          <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-strong)]">
            {wf.name}
          </h4>
          <Badge tone={SOURCE_TONE[wf.source]}>{wf.source}</Badge>
          {wf.isOverridden ? (
            <Badge tone="accent" className="text-[10px]">
              overrides
            </Badge>
          ) : null}
        </header>
        <p className="line-clamp-2 min-h-[2.25rem] text-xs text-[var(--color-muted)]">
          {wf.description ??
            (wf.stepNames.length > 0 ? wf.stepNames.join(' → ') : '(no description)')}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <Badge
            tone={editable.tone}
            className="text-[10px]"
            leading={<StatusDot tone={editable.tone} />}
          >
            {editable.label}
          </Badge>
          <span>·</span>
          <span>{wf.stepNames.length} steps</span>
          {wf.agentRoles.length > 0 ? (
            <>
              <span>·</span>
              <span className="truncate">{wf.agentRoles.slice(0, 3).join(', ')}</span>
            </>
          ) : null}
        </div>
        {canToggleAuto ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
            <Toggle
              checked={autoEligible}
              onCheckedChange={() => onToggleAutoEligible(wf.name, !autoEligible)}
              aria-label={`${t('settings.workflowCatalog.eligibleForAuto')}: ${wf.name}`}
            />
            <span>{t('settings.workflowCatalog.eligibleForAuto')}</span>
          </div>
        ) : null}
        <footer className="mt-1 flex flex-wrap gap-1.5">
          {wf.source === 'project' ? (
            <>
              {yamlOnly ? (
                <Button
                  variant="primary"
                  size="sm"
                  leading={<Code2 size={12} />}
                  onClick={() => onOpenYaml(wf.name)}
                >
                  Open in YAML
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  leading={<Edit3 size={12} />}
                  onClick={() => onOpen(wf.name)}
                >
                  Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                leading={<Code2 size={12} />}
                onClick={() => onOpenYaml(wf.name)}
              >
                YAML
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leading={<CopyPlus size={12} />}
                onClick={() => onDuplicate(wf.name)}
              >
                Duplicate
              </Button>
              {wf.isOverridden ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leading={<FileDiff size={12} />}
                  onClick={() => onDiff(wf.name)}
                >
                  Diff vs builtin
                </Button>
              ) : null}
            </>
          ) : wf.source === 'user' ? (
            <Button
              variant="secondary"
              size="sm"
              leading={<Copy size={12} />}
              onClick={() => void onCopyToProject(wf.name)}
            >
              Copy to project
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leading={<Copy size={12} />}
              onClick={() => void onCopyToProject(wf.name)}
            >
              Copy to project
            </Button>
          )}
        </footer>
      </article>
    )
  }

  function renderGroup(title: string, items: WorkflowSummary[]) {
    if (items.length === 0) return null
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          {title} ({items.length})
        </h3>
        <div className="grid gap-2 md:grid-cols-2">{items.map((wf) => renderWorkflowCard(wf))}</div>
      </section>
    )
  }

  function renderBuiltinSection() {
    if (grouped.builtin.length === 0) return null
    if (builtinGroups.length === 0) {
      return renderGroup('Builtin', grouped.builtin)
    }
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Builtin ({uniqueBuiltinCount})
        </h3>
        <div className="flex flex-col gap-2">
          {builtinGroups.map((group) => (
            <details
              key={group.title}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/30 px-3 py-2"
            >
              <summary className="cursor-pointer text-xs font-semibold text-[var(--color-text-strong)]">
                {group.title} ({group.items.length})
              </summary>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {group.items.map((wf) => renderWorkflowCard(wf))}
              </div>
            </details>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {hideHeader ? null : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" leading={<Plus size={13} />} onClick={onCreateNew}>
              New workflow
            </Button>
            <span className={cn('relative ml-auto inline-flex w-64 items-center')}>
              <Search
                size={12}
                className="pointer-events-none absolute left-2.5 text-[var(--color-muted)]"
              />
              <Input
                className="pl-7"
                placeholder="Search workflows..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            Choose a workflow to edit. Saves to{' '}
            <span className="font-mono">{planetzWorkflowsDirRelPath()}/&lt;name&gt;.yaml</span>.
          </p>
        </>
      )}
      {workflowNameFilter && workflowNameFilter.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/20 px-3 py-2 text-xs text-[var(--color-muted-strong)]">
          <span>
            Filtered by facet{workflowFilterLabel ? `: ${workflowFilterLabel}` : ''} (
            {workflowNameFilter.size} workflow{workflowNameFilter.size === 1 ? '' : 's'})
          </span>
          {onClearWorkflowFilter ? (
            <Button variant="ghost" size="sm" onClick={onClearWorkflowFilter}>
              Clear filter
            </Button>
          ) : null}
        </div>
      ) : null}
      {workflows.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
          No workflows registered yet. Create one with &quot;New workflow&quot;.
        </p>
      ) : (
        <>
          {renderGroup('Project', grouped.project)}
          {renderGroup('User', grouped.user)}
          {renderBuiltinSection()}
          {renderGroup('Path', grouped.path)}
        </>
      )}
    </div>
  )
}
