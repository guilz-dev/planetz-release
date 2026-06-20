import { type OrbitProviderId, orbitProviderDisplayLabel } from '@planetz/shared'
import { CircleDot, CircleSlash } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export interface ProviderScopeChecklistProps {
  /** Provider ids shown in the checklist (dev-only ids omitted unless retained). */
  visibleProviderIds: ReadonlyArray<OrbitProviderId>
  /** Provider ids the user currently allows (checked rows). */
  allowedProviderIds: ReadonlyArray<string>
  /** Provider ids detected as executable by runtime probes. */
  detectedProviderIds: ReadonlyArray<string>
  /** Called when a checkbox is toggled. */
  onToggle: (id: OrbitProviderId, checked: boolean) => void
  /** Quick action: set allowed = detected. */
  onSelectDetected?: () => void
  /** Quick action: set allowed = all known providers. */
  onSelectAll?: () => void
  /** Quick action: clear all (UI must still enforce ≥1 elsewhere). */
  onClear?: () => void
  disabled?: boolean
  /** Compact spacing for use inside Settings panel. */
  density?: 'comfortable' | 'compact'
}

export function ProviderScopeChecklist({
  visibleProviderIds,
  allowedProviderIds,
  detectedProviderIds,
  onToggle,
  onSelectDetected,
  onSelectAll,
  onClear,
  disabled = false,
  density = 'comfortable',
}: ProviderScopeChecklistProps) {
  const { t } = useI18n()
  const allowedSet = useMemo(() => new Set(allowedProviderIds), [allowedProviderIds])
  const detectedSet = useMemo(() => new Set(detectedProviderIds), [detectedProviderIds])

  const detectedIds = useMemo(
    () => visibleProviderIds.filter((id) => detectedSet.has(id)),
    [visibleProviderIds, detectedSet],
  )
  const otherIds = useMemo(
    () => visibleProviderIds.filter((id) => !detectedSet.has(id)),
    [visibleProviderIds, detectedSet],
  )

  const detectedCount = detectedIds.length
  const allowedCount = allowedSet.size

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="subtle"
            size="sm"
            disabled={disabled || detectedCount === 0 || !onSelectDetected}
            onClick={() => onSelectDetected?.()}
          >
            {t('settings.providers.checklist.selectDetected')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !onSelectAll}
            onClick={() => onSelectAll?.()}
          >
            {t('settings.providers.checklist.all')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !onClear || allowedCount === 0}
            onClick={() => onClear?.()}
          >
            {t('settings.providers.checklist.none')}
          </Button>
        </div>
        <span className="text-[11px] text-[var(--color-muted)]">
          {t('settings.providers.checklist.allowedCount', {
            allowed: String(allowedCount),
            total: String(visibleProviderIds.length),
          })}
        </span>
      </div>

      <ProviderSection
        title={t('settings.providers.checklist.detectedTitle')}
        emptyHint={t('settings.providers.checklist.detectedEmpty')}
        ids={detectedIds}
        allowedSet={allowedSet}
        detected
        onToggle={onToggle}
        disabled={disabled}
        density={density}
      />

      <ProviderSection
        title={t('settings.providers.checklist.otherTitle')}
        ids={otherIds}
        allowedSet={allowedSet}
        detected={false}
        onToggle={onToggle}
        disabled={disabled}
        density={density}
      />
    </div>
  )
}

interface ProviderSectionProps {
  title: string
  ids: ReadonlyArray<OrbitProviderId>
  allowedSet: Set<string>
  detected: boolean
  emptyHint?: string
  onToggle: (id: OrbitProviderId, checked: boolean) => void
  disabled: boolean
  density: 'comfortable' | 'compact'
}

function ProviderSection({
  title,
  ids,
  allowedSet,
  detected,
  emptyHint,
  onToggle,
  disabled,
  density,
}: ProviderSectionProps) {
  return (
    <section>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {title}
      </h4>
      {ids.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
          {emptyHint ?? '—'}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          {ids.map((id) => (
            <ProviderRow
              key={id}
              id={id}
              checked={allowedSet.has(id)}
              detected={detected}
              onToggle={onToggle}
              disabled={disabled}
              density={density}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface ProviderRowProps {
  id: OrbitProviderId
  checked: boolean
  detected: boolean
  onToggle: (id: OrbitProviderId, checked: boolean) => void
  disabled: boolean
  density: 'comfortable' | 'compact'
}

function ProviderRow({ id, checked, detected, onToggle, disabled, density }: ProviderRowProps) {
  const { t } = useI18n()
  const pad = density === 'compact' ? 'px-2.5 py-1.5' : 'px-3 py-2'
  return (
    <li>
      <label
        className={`flex cursor-pointer items-center gap-3 ${pad} transition-colors hover:bg-[var(--color-panel)]/60 ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <input
          type="checkbox"
          className="shrink-0"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(id, e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-[var(--color-text)]">
            {orbitProviderDisplayLabel(id)}
          </div>
          <div className="truncate font-mono text-[11px] text-[var(--color-muted)]">{id}</div>
        </div>
        {detected ? (
          <Badge tone="completed" leading={<CircleDot size={10} />}>
            {t('settings.providers.checklist.detectedBadge')}
          </Badge>
        ) : (
          <Badge tone="neutral" leading={<CircleSlash size={10} />}>
            {t('settings.providers.checklist.notDetectedBadge')}
          </Badge>
        )}
      </label>
    </li>
  )
}
