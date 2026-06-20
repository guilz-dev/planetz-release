import {
  filterUserVisibleWorkflows,
  planetzWorkflowsDirRelPath,
  type WorkflowSummary,
  workflowPickerSurfacePrefsFromUi,
} from '@planetz/shared'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useWorkflowLibraryPrefs } from '../../hooks/use-workflow-library-prefs.js'
import { useI18n } from '../../i18n/index.js'
import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'
import { Input } from '../ui/input.js'
import { Tabs } from '../ui/tabs.js'
import { WorkflowCatalog } from './workflow-catalog.js'
import { WorkflowCatalogCoreTab } from './workflow-catalog-core-tab.js'
import { WorkflowCatalogLibraryTab } from './workflow-catalog-library-tab.js'

type CatalogTab = 'core' | 'library' | 'project'

export function WorkflowCatalogTabs({
  workflows,
  workflowNameFilter,
  workflowFilterLabel,
  onClearWorkflowFilter,
  onOpen,
  onOpenYaml,
  onCopyToProject,
  onDuplicate,
  onDiff,
  onCreateNew,
}: {
  workflows: WorkflowSummary[]
  workflowNameFilter?: ReadonlySet<string> | null
  workflowFilterLabel?: string | null
  onClearWorkflowFilter?: () => void
  onOpen: (name: string) => void
  onOpenYaml: (name: string) => void
  onCopyToProject: (name: string) => void
  onDuplicate: (name: string) => void
  onDiff: (name: string) => void
  onCreateNew: () => void
}) {
  const { t } = useI18n()
  const workflowLibraryPrefs = useWorkflowLibraryPrefs()
  const workflowSurfacePrefs = workflowLibraryPrefs.prefs ?? workflowPickerSurfacePrefsFromUi({})
  const [tab, setTab] = useState<CatalogTab>('core')
  const [query, setQuery] = useState('')

  const visibleWorkflows = useMemo(() => filterUserVisibleWorkflows(workflows), [workflows])

  const projectWorkflows = useMemo(
    () => visibleWorkflows.filter((workflow) => workflow.source !== 'builtin'),
    [visibleWorkflows],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" leading={<Plus size={13} />} onClick={onCreateNew}>
          {t('settings.workflowCatalog.newWorkflow')}
        </Button>
        <Tabs
          className="ml-1"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'core', label: t('settings.workflowCatalog.tabCore') },
            { value: 'library', label: t('settings.workflowCatalog.tabLibrary') },
            { value: 'project', label: t('settings.workflowCatalog.tabProject') },
          ]}
        />
        <span className={cn('relative ml-auto inline-flex w-64 items-center')}>
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 text-[var(--color-muted)]"
          />
          <Input
            className="pl-7"
            placeholder={t('settings.workflowCatalog.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </span>
      </div>
      <p className="text-[11px] text-[var(--color-muted)]">
        {t('settings.workflowCatalog.saveHint', { dir: planetzWorkflowsDirRelPath() })}
      </p>
      {workflowNameFilter && workflowNameFilter.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/20 px-3 py-2 text-xs text-[var(--color-muted-strong)]">
          <span>
            {t('settings.workflowCatalog.facetFilter', {
              label: workflowFilterLabel ? `: ${workflowFilterLabel}` : '',
              count: String(workflowNameFilter.size),
            })}
          </span>
          {onClearWorkflowFilter ? (
            <Button variant="ghost" size="sm" onClick={onClearWorkflowFilter}>
              {t('settings.workflowCatalog.clearFilter')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {tab === 'core' ? (
        <WorkflowCatalogCoreTab workflows={visibleWorkflows} query={query} onOpen={onOpen} />
      ) : null}
      {tab === 'library' ? (
        <WorkflowCatalogLibraryTab
          workflows={visibleWorkflows}
          query={query}
          onCopyToProject={onCopyToProject}
        />
      ) : null}
      {tab === 'project' ? (
        <WorkflowCatalog
          workflows={projectWorkflows}
          workflowNameFilter={workflowNameFilter}
          workflowFilterLabel={workflowFilterLabel}
          onClearWorkflowFilter={onClearWorkflowFilter}
          onOpen={onOpen}
          onOpenYaml={onOpenYaml}
          onCopyToProject={onCopyToProject}
          autoEligibleWorkflowNames={workflowSurfacePrefs.workflowLibrary.autoEnabledWorkflows}
          onToggleAutoEligible={(name, enabled) =>
            void (enabled
              ? workflowLibraryPrefs.enableWorkflowForAuto(name)
              : workflowLibraryPrefs.disableWorkflowForAuto(name))
          }
          onDuplicate={onDuplicate}
          onDiff={onDiff}
          onCreateNew={onCreateNew}
          hideHeader
          initialQuery={query}
        />
      ) : null}
    </div>
  )
}
