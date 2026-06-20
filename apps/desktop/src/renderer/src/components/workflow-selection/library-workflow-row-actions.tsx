import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n/index.js'
import { Button } from '../ui/button.js'
import { cn } from '../ui/cn.js'
import { Popover, PopoverAnchor } from '../ui/popover.js'

export function LibraryWorkflowRowActions({
  displayLabel,
  description,
  isHighlighted,
  onHighlight,
  onUseOnce,
  onEnableInWorkspace,
  onCopyToProject,
  showEnableInWorkspace = true,
  trailing,
}: {
  displayLabel: string
  description?: string
  isHighlighted: boolean
  onHighlight: () => void
  onUseOnce: () => void
  onEnableInWorkspace: () => void
  onCopyToProject: () => void
  showEnableInWorkspace?: boolean
  trailing?: React.ReactNode
}) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex items-stretch gap-1 px-2 py-0.5">
      <button
        type="button"
        aria-pressed={isHighlighted}
        onClick={onHighlight}
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          isHighlighted
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-strong)]'
            : 'hover:bg-[var(--color-panel-strong)]',
        )}
      >
        <span className="truncate font-medium">{displayLabel}</span>
        {description ? (
          <span className="truncate text-[11px] text-[var(--color-muted)]">{description}</span>
        ) : null}
      </button>
      <Button
        variant="primary"
        size="sm"
        className="h-auto shrink-0 self-center px-2 text-[10px]"
        onClick={onUseOnce}
      >
        {t('composer.workflowPicker.useOnce')}
      </Button>
      <PopoverAnchor>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 self-center p-0"
          aria-label={t('composer.workflowPicker.moreActions')}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal size={14} />
        </Button>
        <Popover open={menuOpen} onClose={() => setMenuOpen(false)} placement="bottom-end">
          <div className="flex min-w-[10rem] flex-col gap-0.5 p-1 text-sm">
            {showEnableInWorkspace ? (
              <button
                type="button"
                className="rounded px-2 py-1.5 text-left hover:bg-[var(--color-panel-strong)]"
                onClick={() => {
                  onEnableInWorkspace()
                  setMenuOpen(false)
                }}
              >
                {t('composer.workflowPicker.enableInWorkspace')}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded px-2 py-1.5 text-left hover:bg-[var(--color-panel-strong)]"
              onClick={() => {
                onCopyToProject()
                setMenuOpen(false)
              }}
            >
              {t('composer.workflowPicker.copyToProject')}
            </button>
          </div>
        </Popover>
      </PopoverAnchor>
      {trailing}
    </div>
  )
}
