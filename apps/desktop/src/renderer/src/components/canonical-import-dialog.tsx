import {
  type CanonicalImportOffer,
  ORBIT_IMPORT_SNAPSHOT_DIRNAME,
  planetzEngineConfigRelPath,
  planetzWorkflowsDirRelPath,
  SIDECAR_DIR_NAME,
} from '@planetz/shared'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'

interface CanonicalImportDialogProps {
  offer: CanonicalImportOffer
  onConfirm: (options: { importHomeGlobal?: boolean }) => Promise<void>
  onDismiss: () => Promise<void>
}

export function CanonicalImportDialog({ offer, onConfirm, onDismiss }: CanonicalImportDialogProps) {
  const [busy, setBusy] = useState(false)
  const [importHomeGlobal, setImportHomeGlobal] = useState(false)

  const workflowList = offer.workflows.length > 0 ? offer.workflows.join(', ') : '(none)'

  return (
    <Dialog
      open
      onClose={() => void onDismiss()}
      title="Import takt settings into Planetz?"
      description="Planetz can import available takt settings into this workspace. Your existing Planetz files are kept."
      size="md"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={() => void onDismiss()}>
            Skip for now
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            leading={<Download size={13} />}
            onClick={() => {
              setBusy(true)
              void onConfirm({
                importHomeGlobal: offer.homeGlobalAvailable ? importHomeGlobal : undefined,
              }).finally(() => setBusy(false))
            }}
          >
            {busy ? 'Importing…' : 'Import settings'}
          </Button>
        </>
      }
    >
      <ul className="list-disc space-y-2 pl-4 text-sm text-[var(--color-text)]">
        {offer.engineConfig ? <li>Engine settings</li> : null}
        {offer.workflows.length > 0 ? <li>Workflow defaults ({workflowList})</li> : null}
      </ul>
      {offer.homeGlobalAvailable ? (
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={importHomeGlobal}
            disabled={busy}
            onChange={(e) => setImportHomeGlobal(e.target.checked)}
          />
          <span>Also import global ~/.takt settings (optional)</span>
        </label>
      ) : null}
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        You can skip this now and import later.
      </p>
      <details className="mt-2 text-xs text-[var(--color-muted)]">
        <summary className="cursor-pointer select-none">Technical details</summary>
        <div className="mt-1 space-y-1">
          <p>
            Existing <span className="font-mono">{SIDECAR_DIR_NAME}</span> files are kept.
          </p>
          <p>
            Engine config path: <span className="font-mono">{planetzEngineConfigRelPath()}</span>
          </p>
          <p>
            Workflow path: <span className="font-mono">{planetzWorkflowsDirRelPath()}/</span>
          </p>
          <p>
            Optional global import uses{' '}
            <span className="font-mono">
              {SIDECAR_DIR_NAME}/{ORBIT_IMPORT_SNAPSHOT_DIRNAME}/
            </span>{' '}
            as one-time source.
          </p>
        </div>
      </details>
    </Dialog>
  )
}
