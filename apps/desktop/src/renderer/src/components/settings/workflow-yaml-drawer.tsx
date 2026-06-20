import { X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/input'

interface YamlDrawerProps {
  open: boolean
  yaml: string
  onChange: (next: string) => void
  onClose: () => void
  onApplyToForm: () => void
  onSaveYaml?: () => void
  canSaveYaml?: boolean
  saving?: boolean
}

export function WorkflowYamlDrawer({
  open,
  yaml,
  onChange,
  onClose,
  onApplyToForm,
  onSaveYaml,
  canSaveYaml = false,
  saving = false,
}: YamlDrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex bg-[var(--color-overlay)]/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: container stops bubbling to backdrop close */}
      <div
        className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] shadow-2xl shadow-black/40"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">workflow.yaml</h2>
            <p className="text-[11px] text-[var(--color-muted)]">
              Escape hatch — edit areas the form cannot touch. Press ⌘E to close.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]"
          >
            <X size={14} strokeWidth={2.25} />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          <Textarea
            spellCheck={false}
            value={yaml}
            onChange={(e) => onChange(e.target.value)}
            className="h-full min-h-[60vh] font-[var(--font-mono)] text-xs"
          />
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-3">
          <p className="text-[11px] text-[var(--color-muted)]">
            Unsaved — apply to the form or save directly.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {onSaveYaml ? (
              <Button variant="primary" onClick={onSaveYaml} disabled={!canSaveYaml || saving}>
                {saving ? 'Saving…' : 'Save to project'}
              </Button>
            ) : null}
            <Button variant={onSaveYaml ? 'ghost' : 'primary'} onClick={onApplyToForm}>
              Apply to form
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
