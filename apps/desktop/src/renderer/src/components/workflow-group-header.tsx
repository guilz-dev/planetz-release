import { ChevronRight } from 'lucide-react'
import { cn } from './ui/cn'
import { RECENT_GROUP_KEY, type WorkflowGroup } from './workflow-combobox-groups.js'

const GROUP_HEADER_CLASS =
  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-strong)]'

interface WorkflowGroupHeaderProps {
  group: WorkflowGroup
  expanded: boolean
  onToggle: (groupKey: string) => void
}

export function WorkflowGroupHeader({ group, expanded, onToggle }: WorkflowGroupHeaderProps) {
  const isRecentGroup = group.key === RECENT_GROUP_KEY
  const content = (
    <>
      <ChevronRight
        size={12}
        aria-hidden
        className={cn(
          'shrink-0 text-[var(--color-muted)] transition-transform',
          expanded && 'rotate-90',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{group.title}</span>
      <span className="text-[10px] font-normal text-[var(--color-muted)]">
        {group.items.length}
      </span>
    </>
  )

  if (isRecentGroup) {
    return (
      <div role="group" aria-label={group.title} className={GROUP_HEADER_CLASS}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      className={cn(GROUP_HEADER_CLASS, 'hover:bg-[var(--color-panel-strong)]')}
      onClick={() => onToggle(group.key)}
    >
      {content}
    </button>
  )
}
