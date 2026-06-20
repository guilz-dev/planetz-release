import {
  buildWorkflowCallTargetGroups,
  getBuiltinWorkflowTierMeta,
  tierMetaByWorkflowName,
  type WorkflowSummary,
  workflowDisplayLabel,
} from '@planetz/shared'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/index.js'
import { Button } from '../ui/button.js'
import { Dialog } from '../ui/dialog.js'
import { Input } from '../ui/input.js'
import { WorkflowTargetListRow } from '../workflow-selection/workflow-target-list-row.js'

function resolveDisplayLabel(workflow: WorkflowSummary): string {
  const meta = workflow.source === 'builtin' ? getBuiltinWorkflowTierMeta(workflow.name) : undefined
  return workflowDisplayLabel(workflow, meta)
}

export function WorkflowCallTargetPicker({
  workflows,
  value,
  disabled,
  onChange,
}: {
  workflows: WorkflowSummary[]
  value: string
  disabled?: boolean
  onChange: (name: string) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const tierMeta = useMemo(() => tierMetaByWorkflowName(workflows), [workflows])

  const selectedWorkflow = useMemo(() => {
    const match = workflows.find((workflow) => workflow.name === value)
    if (match) return match
    if (!value) return undefined
    return {
      name: value,
      source: 'path' as const,
      stepNames: [],
      agentRoles: [],
      steps: [],
      isOverridden: false,
      diagnostics: [],
    }
  }, [value, workflows])

  const groups = useMemo(
    () =>
      buildWorkflowCallTargetGroups({
        workflows,
        query,
        preserveSelectedName: value || undefined,
        groupTitles: {
          project: t('settings.workflowCall.groupProject'),
          user: t('settings.workflowCall.groupUser'),
          core: t('settings.workflowCall.groupCore'),
          library: t('settings.workflowCall.groupLibrary'),
          path: t('settings.workflowCall.groupPath'),
          preservedSystem: t('settings.workflowCall.groupPreservedSystem'),
        },
      }),
    [query, t, value, workflows],
  )

  const displayValue = selectedWorkflow
    ? resolveDisplayLabel(selectedWorkflow)
    : t('settings.workflowCall.placeholder')

  function select(name: string) {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-2 text-sm">
          <span className="block truncate font-medium text-[var(--color-text-strong)]">
            {displayValue}
          </span>
          {value ? (
            <span className="block truncate font-mono text-[10px] text-[var(--color-muted)]">
              {value}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={t('settings.workflowCall.change')}
          onClick={() => setOpen(true)}
        >
          {t('settings.workflowCall.change')}
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          setQuery('')
        }}
        size="lg"
        title={t('settings.workflowCall.dialogTitle')}
        description={t('settings.workflowCall.dialogDescription')}
        bodyClassName="flex max-h-[min(60vh,28rem)] min-h-0 flex-col gap-3 overflow-hidden p-4"
      >
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('settings.workflowCall.searchPlaceholder')}
            className="pl-8"
            aria-label={t('settings.workflowCall.searchPlaceholder')}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-[var(--color-border)]">
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[var(--color-muted)]">
              {t('settings.workflowCall.empty')}
            </p>
          ) : (
            groups.map((group) => (
              <section
                key={group.key}
                className="border-b border-[var(--color-border)] last:border-b-0"
              >
                <header className="sticky top-0 z-10 bg-[var(--color-panel)]/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {group.title}
                </header>
                <div className="flex flex-col py-1">
                  {group.items.map((workflow) => {
                    const meta = tierMeta.get(workflow.name)
                    return (
                      <WorkflowTargetListRow
                        key={`${group.key}:${workflow.name}`}
                        displayLabel={resolveDisplayLabel(workflow)}
                        internalName={workflow.name}
                        tierReason={meta?.tierReason}
                        isHighlighted={workflow.name === value}
                        selectLabel={t('settings.workflowCall.select')}
                        onSelect={() => select(workflow.name)}
                      />
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </Dialog>
    </>
  )
}
