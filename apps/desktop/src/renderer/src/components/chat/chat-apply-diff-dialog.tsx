import type {
  ChatApplySkipReason,
  ChatSessionPendingChangesResult,
  TaskResultDiffFile,
} from '@planetz/shared'
import { AlertTriangle, FileDiff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type TranslateFn, useI18n } from '../../i18n'
import { Button } from '../ui/button'
import { cn } from '../ui/cn'
import { Dialog } from '../ui/dialog'

type ChatApplyDiffDialogProps = {
  open: boolean
  onClose: () => void
  pending: ChatSessionPendingChangesResult | null
  loadingFile?: boolean
  fileContent?: TaskResultDiffFile
  selectedPath?: string
  onSelectFile: (path: string) => void
  onLoadFile?: (path: string) => void
  onApply: (paths: string[]) => void
  applying?: boolean
}

function skipReasonLabel(t: TranslateFn, reason: ChatApplySkipReason): string {
  switch (reason) {
    case 'workspace_modified_since_base':
      return t('chat.applySkip.workspaceModified')
    case 'deleted_not_supported':
      return t('chat.applySkip.deletedNotSupported')
    case 'rename_requires_manual_apply':
      return t('chat.applySkip.renameManual')
    case 'binary_not_supported':
      return t('chat.applySkip.binaryNotSupported')
    case 'deleted_on_workspace':
      return t('chat.applySkip.deletedOnWorkspace')
    case 'renamed_on_workspace':
      return t('chat.applySkip.renamedOnWorkspace')
    default:
      return t('chat.applySkip.notApplicable')
  }
}

export function ChatApplyDiffDialog({
  open,
  onClose,
  pending,
  loadingFile,
  fileContent,
  selectedPath,
  onSelectFile,
  onLoadFile,
  onApply,
  applying = false,
}: ChatApplyDiffDialogProps) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const applicablePaths = useMemo(
    () => pending?.files.filter((file) => file.applicable).map((file) => file.path) ?? [],
    [pending],
  )

  useEffect(() => {
    if (!open) return
    setSelected(new Set(applicablePaths))
  }, [open, applicablePaths])

  const togglePath = useCallback((path: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  const files = pending?.files ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="full"
      title={
        <span className="flex items-center gap-2">
          <FileDiff size={16} className="text-[var(--color-accent)]" />
          {t('chat.applyDialogTitle')}
        </span>
      }
      description={
        pending ? (
          <span className="font-mono text-xs text-[var(--color-muted)]">
            {pending.baseRef} → workspace
          </span>
        ) : null
      }
      bodyClassName="flex-1 min-h-0 overflow-hidden"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={applying}>
            {t('chat.applyCancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={applying || selected.size === 0}
            onClick={() => onApply([...selected])}
          >
            {t('chat.applyConfirm')}
          </Button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 gap-4">
        <ul className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--color-border)] pr-2">
          {files.map((file) => {
            const disabled = !file.applicable
            const checked = selected.has(file.path)
            return (
              <li key={file.path}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs',
                    selectedPath === file.path && 'bg-[var(--color-panel-strong)]',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => togglePath(file.path, event.target.checked)}
                    aria-label={file.path}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[var(--color-text)]">
                      {file.path}
                    </span>
                    {file.skipReason ? (
                      <span className="mt-0.5 flex items-center gap-1 text-[var(--color-status-failed)]">
                        <AlertTriangle size={11} />
                        {skipReasonLabel(t, file.skipReason)}
                      </span>
                    ) : null}
                  </span>
                </label>
                <button
                  type="button"
                  className="ml-7 text-[10px] text-[var(--color-accent)] hover:underline"
                  onClick={() => {
                    onSelectFile(file.path)
                    onLoadFile?.(file.path)
                  }}
                >
                  {t('chat.applyPreviewFile')}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="min-w-0 flex-1 overflow-auto font-mono text-xs">
          {loadingFile ? (
            <p className="text-[var(--color-muted)]">{t('chat.applyLoadingFile')}</p>
          ) : fileContent ? (
            <pre className="whitespace-pre-wrap break-all text-[var(--color-text)]">
              {fileContent.lines.map((line) => line.text).join('\n')}
            </pre>
          ) : (
            <p className="text-[var(--color-muted)]">{t('chat.applySelectFileHint')}</p>
          )}
        </div>
      </div>
    </Dialog>
  )
}
