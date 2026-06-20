import type { CreateResultPrInput, TaskPrErrorCode } from '@planetz/shared'
import { extractTaskPrErrorCode } from '@planetz/shared'
import { GitPullRequest } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { I18nKey } from '../i18n/catalog.js'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'
import { Field, Input, Textarea } from './ui/input'

const PR_ERROR_I18N_KEYS: Record<TaskPrErrorCode, I18nKey> = {
  gh_not_found: 'panels.result.prErrors.gh_not_found',
  gh_auth_required: 'panels.result.prErrors.gh_auth_required',
  permission_denied: 'panels.result.prErrors.permission_denied',
  repo_not_supported: 'panels.result.prErrors.repo_not_supported',
  branch_not_found: 'panels.result.prErrors.branch_not_found',
  push_required: 'panels.result.prErrors.push_required',
  push_failed: 'panels.result.prErrors.push_failed',
  pr_create_failed: 'panels.result.prErrors.pr_create_failed',
  unexpected_failure: 'panels.result.prErrors.unexpected_failure',
}

function prErrorMessage(t: (key: I18nKey) => string, error: unknown): string {
  const code = extractTaskPrErrorCode(error)
  if (!code) {
    return error instanceof Error ? error.message : String(error)
  }
  return t(PR_ERROR_I18N_KEYS[code])
}

interface TaskCreatePrDialogProps {
  open: boolean
  taskId: string
  branch: string
  defaultTitle: string
  busy: boolean
  onClose: () => void
  onSubmit: (input: Omit<CreateResultPrInput, 'taskId' | 'branch'>) => Promise<void>
  checkBranch: (input: { taskId: string; branch: string }) => Promise<{
    exists: boolean
    defaultBaseBranch?: string
  }>
  onBranchUnavailable: () => void
}

export function TaskCreatePrDialog({
  open,
  taskId,
  branch,
  defaultTitle,
  busy,
  onClose,
  onSubmit,
  checkBranch,
  onBranchUnavailable,
}: TaskCreatePrDialogProps) {
  const { t } = useI18n()
  const [baseBranch, setBaseBranch] = useState('main')
  const [title, setTitle] = useState(defaultTitle)
  const [body, setBody] = useState('')
  const [draft, setDraft] = useState(false)
  const [pushIfNeeded, setPushIfNeeded] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingBranch, setCheckingBranch] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(defaultTitle)
    setBody('')
    setDraft(false)
    setPushIfNeeded(true)
    setError(null)
    setCheckingBranch(true)
    void checkBranch({ taskId, branch })
      .then((result) => {
        if (!result.exists) {
          onBranchUnavailable()
          onClose()
          return
        }
        if (result.defaultBaseBranch) {
          setBaseBranch(result.defaultBaseBranch)
        }
      })
      .catch((err) => {
        setError(prErrorMessage(t, err))
      })
      .finally(() => {
        setCheckingBranch(false)
      })
  }, [open, taskId, branch, defaultTitle, checkBranch, onBranchUnavailable, onClose, t])

  if (!open) return null

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={t('panels.result.createPr')}
      description={
        <>
          Head branch: <span className="font-mono text-[var(--color-text)]">{branch}</span>
        </>
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leading={<GitPullRequest size={14} />}
            disabled={busy || checkingBranch}
            onClick={() => {
              setError(null)
              void onSubmit({
                baseBranch,
                title,
                body,
                draft,
                pushIfNeeded,
              }).catch((err) => {
                setError(prErrorMessage(t, err))
              })
            }}
          >
            {busy ? t('panels.result.createPrBusy') : t('panels.result.createPr')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Base branch">
          <Input
            value={baseBranch}
            onChange={(event) => setBaseBranch(event.target.value)}
            disabled={busy || checkingBranch}
          />
        </Field>
        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy || checkingBranch}
          />
        </Field>
        <Field label="Body">
          <div className="flex flex-col gap-1">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={busy || checkingBranch}
              rows={6}
              placeholder={t('panels.result.createPrBodyAutoHint')}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('panels.result.createPrBodyAutoHint')}
            </p>
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={draft}
            onChange={(event) => setDraft(event.target.checked)}
            disabled={busy || checkingBranch}
          />
          Create as draft
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={pushIfNeeded}
            onChange={(event) => setPushIfNeeded(event.target.checked)}
            disabled={busy || checkingBranch}
          />
          Push branch to origin if needed
        </label>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      </div>
    </Dialog>
  )
}
