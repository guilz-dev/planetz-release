import {
  getBuiltinWorkflowTierMeta,
  orderCoreBuiltinWorkflows,
  type WorkflowSummary,
  workflowDisplayLabel,
  workflowPickerSurfacePrefsFromUi,
} from '@planetz/shared'
import { Edit3 } from 'lucide-react'
import { useMemo } from 'react'
import { useWorkflowLibraryPrefs } from '../../hooks/use-workflow-library-prefs.js'
import { useI18n } from '../../i18n/index.js'
import { Badge } from '../ui/badge.js'
import { Button } from '../ui/button.js'
import { Toggle } from '../ui/toggle.js'

export function WorkflowCatalogCoreTab({
  workflows,
  query,
  onOpen,
}: {
  workflows: WorkflowSummary[]
  query: string
  onOpen: (name: string) => void
}) {
  const { t } = useI18n()
  const libraryPrefs = useWorkflowLibraryPrefs()
  const surfacePrefs = libraryPrefs.prefs ?? workflowPickerSurfacePrefsFromUi({})
  const tierMeta = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getBuiltinWorkflowTierMeta>>()
    for (const workflow of workflows) {
      if (workflow.source === 'builtin') {
        map.set(workflow.name, getBuiltinWorkflowTierMeta(workflow.name))
      }
    }
    return map
  }, [workflows])

  const items = useMemo(() => {
    const core = workflows.filter(
      (workflow) =>
        workflow.source === 'builtin' && getBuiltinWorkflowTierMeta(workflow.name).tier === 'core',
    )
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = normalizedQuery
      ? core.filter((workflow) => {
          const label = workflowDisplayLabel(workflow, tierMeta.get(workflow.name)).toLowerCase()
          return (
            workflow.name.toLowerCase().includes(normalizedQuery) ||
            label.includes(normalizedQuery) ||
            (workflow.description?.toLowerCase().includes(normalizedQuery) ?? false)
          )
        })
      : core
    return orderCoreBuiltinWorkflows(filtered, surfacePrefs)
  }, [query, surfacePrefs, tierMeta, workflows])

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
        {t('settings.workflowCatalog.coreEmpty')}
      </p>
    )
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {items.map((workflow) => {
        const meta = tierMeta.get(workflow.name)
        const pinned = surfacePrefs.pinnedWorkflows.includes(workflow.name)
        const hidden = surfacePrefs.hiddenCoreWorkflows.includes(workflow.name)
        return (
          <article
            key={workflow.name}
            className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3"
          >
            <header className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                  {workflowDisplayLabel(workflow, meta)}
                </h4>
                <p className="font-mono text-[10px] text-[var(--color-muted)]">{workflow.name}</p>
              </div>
              <Badge tone="neutral">core</Badge>
            </header>
            <p className="line-clamp-2 text-xs text-[var(--color-muted)]">
              {workflow.description ?? `${workflow.stepNames.length} steps`}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
              <div className="inline-flex items-center gap-2">
                <Toggle
                  checked={pinned}
                  onCheckedChange={() => void libraryPrefs.togglePinnedCore(workflow.name)}
                  aria-label={`${t('settings.workflowCatalog.pinInPicker')}: ${workflow.name}`}
                />
                {t('settings.workflowCatalog.pinInPicker')}
              </div>
              <div className="inline-flex items-center gap-2">
                <Toggle
                  checked={hidden}
                  onCheckedChange={() => void libraryPrefs.toggleHiddenCore(workflow.name)}
                  aria-label={`${t('settings.workflowCatalog.hideFromPicker')}: ${workflow.name}`}
                />
                {t('settings.workflowCatalog.hideFromPicker')}
              </div>
            </div>
            <footer className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                leading={<Edit3 size={12} />}
                onClick={() => onOpen(workflow.name)}
              >
                {t('settings.workflowCatalog.open')}
              </Button>
              <span className="self-center text-[10px] text-[var(--color-muted)]">
                {t('settings.workflowCatalog.copyToProjectHint')}
              </span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
