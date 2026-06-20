import {
  canEnablePackInWorkspace,
  canEnableWorkflowForAuto,
  canEnableWorkflowInWorkspace,
  getBuiltinWorkflowTierMeta,
  isExplicitlyEnabledLibraryWorkflow,
  listLibraryPackBrowseGroups,
  partitionPackBrowseItems,
  shouldShowImplicitEnableBadge,
  type WorkflowSummary,
  workflowDisplayLabel,
  workflowPickerSurfacePrefsFromUi,
} from '@planetz/shared'
import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useWorkflowLibraryPrefs } from '../../hooks/use-workflow-library-prefs.js'
import { useI18n } from '../../i18n/index.js'
import { Button } from '../ui/button.js'
import { Toggle } from '../ui/toggle.js'
import { ImplicitEnableBadge } from '../workflow-selection/implicit-enable-badge.js'
import { LibraryWorkflowPreview } from './library-workflow-preview.js'
import { WorkflowFamilyBadges } from './workflow-family-badges.js'

function LibraryPackWorkflowRow({
  workflow,
  packId,
  libraryUi,
  libraryPrefs,
  onCopyToProject,
  t,
}: {
  workflow: WorkflowSummary
  packId: string
  libraryUi: ReturnType<typeof workflowPickerSurfacePrefsFromUi>['workflowLibrary']
  libraryPrefs: ReturnType<typeof useWorkflowLibraryPrefs>
  onCopyToProject: (name: string) => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const meta = getBuiltinWorkflowTierMeta(workflow.name)
  const visible = isExplicitlyEnabledLibraryWorkflow(workflow.name, libraryUi)
  const autoEnabled = libraryUi.autoEnabledWorkflows.includes(workflow.name)
  const workspaceGuard = canEnableWorkflowInWorkspace(workflow.name)
  const autoGuard = canEnableWorkflowForAuto(workflow.name)
  const visibleToggleDisabled = !visible && !workspaceGuard.allowed
  const autoToggleDisabled = !autoEnabled && !autoGuard.allowed
  const showImplicitBadge = shouldShowImplicitEnableBadge(workflow.name, libraryUi)

  return (
    <article className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold">
              {workflowDisplayLabel(workflow, meta)}
            </h4>
            <WorkflowFamilyBadges workflowName={workflow.name} />
          </div>
          <p className="font-mono text-[10px] text-[var(--color-muted)]">{workflow.name}</p>
          {meta.tierReason ? (
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">{meta.tierReason}</p>
          ) : null}
          {meta.successorName ? (
            <p className="mt-1 text-[11px] text-[var(--color-muted-strong)]">
              {t('settings.workflowCatalog.successor', { name: meta.successorName })}
            </p>
          ) : null}
          {(packId === 'audit' || packId === 'review-and-fix') && meta.displayRank != null ? (
            <p className="mt-1 text-[11px] text-[var(--color-muted-strong)]">
              {t('settings.workflowCatalog.packRecommendedEntry')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="inline-flex items-center gap-2">
          <Toggle
            checked={visible}
            disabled={visibleToggleDisabled}
            onCheckedChange={() =>
              void (visible
                ? libraryPrefs.disableWorkflowInWorkspace(workflow.name)
                : libraryPrefs.enableWorkflowInWorkspace(workflow.name))
            }
            aria-label={`${t('settings.workflowCatalog.visibleInPicker')}: ${workflow.name}`}
          />
          {t('settings.workflowCatalog.visibleInPicker')}
        </div>
        <div className="inline-flex items-center gap-2">
          <Toggle
            checked={autoEnabled}
            disabled={autoToggleDisabled}
            onCheckedChange={() =>
              void (autoEnabled
                ? libraryPrefs.disableWorkflowForAuto(workflow.name)
                : libraryPrefs.enableWorkflowForAuto(workflow.name))
            }
            aria-label={`${t('settings.workflowCatalog.eligibleForAuto')}: ${workflow.name}`}
          />
          {t('settings.workflowCatalog.eligibleForAuto')}
        </div>
      </div>
      {showImplicitBadge ? (
        <ImplicitEnableBadge
          workflowName={workflow.name}
          onDismiss={() => void libraryPrefs.dismissImplicitWorkflow(workflow.name)}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <LibraryWorkflowPreview workflowName={workflow.name} />
        <Button
          variant="ghost"
          size="sm"
          leading={<Copy size={12} />}
          onClick={() => onCopyToProject(workflow.name)}
        >
          {t('settings.workflowCatalog.copyToProject')}
        </Button>
      </div>
    </article>
  )
}

function WorkflowCatalogLibraryPack({
  pack,
  packDefaultOpen,
  surfacePrefs,
  libraryPrefs,
  onCopyToProject,
  t,
}: {
  pack: ReturnType<typeof listLibraryPackBrowseGroups>[number]
  packDefaultOpen: boolean
  surfacePrefs: ReturnType<typeof workflowPickerSurfacePrefsFromUi>
  libraryPrefs: ReturnType<typeof useWorkflowLibraryPrefs>
  onCopyToProject: (name: string) => void
  t: ReturnType<typeof useI18n>['t']
}) {
  const [open, setOpen] = useState(packDefaultOpen)
  const memberNames = pack.items.map((workflow) => workflow.name)
  const packEnableGuard = canEnablePackInWorkspace(memberNames)
  const packEnabled = surfacePrefs.workflowLibrary.enabledPacks.includes(pack.packId)
  const { active, deprecated } = partitionPackBrowseItems(pack.items)

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/30 px-3 py-2"
    >
      <summary className="flex cursor-pointer flex-col gap-1 text-xs font-semibold text-[var(--color-text-strong)]">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1">{pack.title}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!packEnabled && !packEnableGuard.allowed}
            onClick={(event) => {
              event.preventDefault()
              void libraryPrefs.enablePackInWorkspace(pack.packId, memberNames)
            }}
          >
            {t('settings.workflowCatalog.enablePack')}
          </Button>
        </span>
        {pack.packId === 'mini-variants' ? (
          <span className="text-[11px] font-normal text-[var(--color-muted-strong)]">
            {t('settings.workflowCatalog.miniVariantsHint')}
          </span>
        ) : null}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {active.map((workflow) => (
          <LibraryPackWorkflowRow
            key={workflow.name}
            workflow={workflow}
            packId={pack.packId}
            libraryUi={surfacePrefs.workflowLibrary}
            libraryPrefs={libraryPrefs}
            onCopyToProject={onCopyToProject}
            t={t}
          />
        ))}
        {deprecated.length > 0 ? (
          <details className="rounded-md border border-dashed border-[var(--color-border)] px-2 py-1">
            <summary className="cursor-pointer py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {t('settings.workflowCatalog.deprecatedPackSection', {
                count: deprecated.length,
              })}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {deprecated.map((workflow) => (
                <LibraryPackWorkflowRow
                  key={workflow.name}
                  workflow={workflow}
                  packId={pack.packId}
                  libraryUi={surfacePrefs.workflowLibrary}
                  libraryPrefs={libraryPrefs}
                  onCopyToProject={onCopyToProject}
                  t={t}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  )
}

export function WorkflowCatalogLibraryTab({
  workflows,
  query,
  onCopyToProject,
}: {
  workflows: WorkflowSummary[]
  query: string
  onCopyToProject: (name: string) => void
}) {
  const { t } = useI18n()
  const libraryPrefs = useWorkflowLibraryPrefs()
  const surfacePrefs = libraryPrefs.prefs ?? workflowPickerSurfacePrefsFromUi({})
  const normalizedQuery = query.trim().toLowerCase()
  const filteredWorkflows = useMemo(() => {
    if (!normalizedQuery) return workflows
    return workflows.filter((workflow) => {
      const meta =
        workflow.source === 'builtin' ? getBuiltinWorkflowTierMeta(workflow.name) : undefined
      const label = workflowDisplayLabel(workflow, meta).toLowerCase()
      return (
        workflow.name.toLowerCase().includes(normalizedQuery) ||
        label.includes(normalizedQuery) ||
        (workflow.description?.toLowerCase().includes(normalizedQuery) ?? false)
      )
    })
  }, [normalizedQuery, workflows])

  const packGroups = useMemo(
    () => listLibraryPackBrowseGroups({ workflows: filteredWorkflows, prefs: surfacePrefs }),
    [filteredWorkflows, surfacePrefs],
  )

  if (packGroups.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-xs text-[var(--color-muted)]">
        {t('settings.workflowCatalog.libraryEmpty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {packGroups.map((pack) => (
        <WorkflowCatalogLibraryPack
          key={pack.packId}
          pack={pack}
          packDefaultOpen={partitionPackBrowseItems(pack.items).active.length > 0}
          surfacePrefs={surfacePrefs}
          libraryPrefs={libraryPrefs}
          onCopyToProject={onCopyToProject}
          t={t}
        />
      ))}
    </div>
  )
}
