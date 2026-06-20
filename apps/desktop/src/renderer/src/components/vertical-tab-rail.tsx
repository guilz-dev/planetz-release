import {
  BarChart3,
  GitBranch,
  Github,
  ListChecks,
  Plug,
  Scale,
  ScrollText,
  Telescope,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { useI18n } from '../i18n'
import type { ActiveView } from '../store/app-store'
import { cn } from './ui/cn'

interface RailEntry {
  id: ActiveView
  labelKey:
    | 'views.rail.task'
    | 'views.rail.workflow'
    | 'views.rail.adapter'
    | 'views.rail.log'
    | 'views.rail.summary'
    | 'views.rail.issue'
    | 'views.rail.decisions'
    | 'views.rail.specStudio'
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  badgeCount?: number
}

const ENTRIES: ReadonlyArray<RailEntry> = [
  { id: 'task', labelKey: 'views.rail.task', icon: ListChecks },
  { id: 'issue', labelKey: 'views.rail.issue', icon: Github },
  { id: 'spec-studio', labelKey: 'views.rail.specStudio', icon: Telescope },
  { id: 'decisions', labelKey: 'views.rail.decisions', icon: Scale },
  { id: 'workflow', labelKey: 'views.rail.workflow', icon: GitBranch },
  { id: 'log', labelKey: 'views.rail.log', icon: ScrollText },
  { id: 'summary', labelKey: 'views.rail.summary', icon: BarChart3 },
  { id: 'adapter', labelKey: 'views.rail.adapter', icon: Plug },
]

interface VerticalTabRailProps {
  active: ActiveView
  onChange: (view: ActiveView) => void
  pendingDecisionCount?: number
}

export function VerticalTabRail({
  active,
  onChange,
  pendingDecisionCount = 0,
}: VerticalTabRailProps) {
  const { t } = useI18n()
  const entries = ENTRIES.map((entry) =>
    entry.id === 'spec-studio' ? { ...entry, badgeCount: pendingDecisionCount } : entry,
  )

  return (
    <nav
      aria-label={t('views.primaryViewAria')}
      className="flex w-16 shrink-0 flex-col items-stretch gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 px-1.5 py-2"
    >
      {entries.map((entry) => {
        const Icon = entry.icon
        const isActive = active === entry.id
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onChange(entry.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md px-1 py-2.5 text-[10px] font-medium transition-colors',
              isActive
                ? 'bg-[var(--color-panel-strong)] text-[var(--color-text-strong)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-text)]',
            )}
          >
            <span className="relative">
              <Icon size={16} />
              {entry.badgeCount != null && entry.badgeCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--color-alert)] px-0.5 text-[9px] font-semibold text-white">
                  {entry.badgeCount > 99 ? '99+' : entry.badgeCount}
                </span>
              ) : null}
            </span>
            <span className="tracking-wide">{t(entry.labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
