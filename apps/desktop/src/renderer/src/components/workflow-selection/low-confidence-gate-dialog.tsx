import type { AutoWorkflowDecision } from '@planetz/shared'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button.js'
import { Dialog } from '../ui/dialog.js'

export function LowConfidenceGateDialog({
  open,
  decision,
  onChoose,
  onCancel,
}: {
  open: boolean
  decision: AutoWorkflowDecision | null
  onChoose: (workflow: string) => void
  onCancel: () => void
}) {
  if (!decision) return null

  const candidates = [
    decision.selectedWorkflow,
    ...decision.alternatives.map((alt) => alt.name),
  ].filter((name, index, arr) => arr.indexOf(name) === index)

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Low-confidence routing"
      description="Auto routing is uncertain. Pick a workflow before continuing."
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="flex items-start gap-2 text-sm text-[var(--color-muted-strong)]">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-[var(--color-status-warn,#d97706)]"
          />
          Confidence is low. Confirm which workflow should run.
        </p>
        <div className="flex flex-col gap-2">
          {candidates.slice(0, 3).map((name) => (
            <Button key={name} variant="subtle" onClick={() => onChoose(name)}>
              {name}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}
