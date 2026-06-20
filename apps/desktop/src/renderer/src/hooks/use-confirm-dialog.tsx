import { useCallback, useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { useI18n } from '../i18n'

export interface ConfirmDialogRequest {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
}

type PendingConfirmState = ConfirmDialogRequest & { resolve: (value: boolean) => void }

/**
 * Modal confirm flow to replace synchronous `confirm()` where async UI fits better.
 */
export function useConfirmDialog() {
  const { t } = useI18n()
  const [pending, setPending] = useState<PendingConfirmState | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const requestConfirm = useCallback((req: ConfirmDialogRequest | string) => {
    const normalized: ConfirmDialogRequest = typeof req === 'string' ? { message: req } : req
    return new Promise<boolean>((resolve) => {
      setPending((current) => {
        if (current) {
          resolve(false)
          return current
        }
        return { ...normalized, resolve }
      })
    })
  }, [])

  const close = useCallback((value: boolean) => {
    setPending((current) => {
      if (!current) return null
      current.resolve(value)
      return null
    })
  }, [])

  const confirmDialog = pending ? (
    <Dialog
      open
      title={pending.title ?? t('common.confirm')}
      description={pending.message}
      size="sm"
      onClose={() => close(false)}
      initialFocusRef={cancelButtonRef}
      footer={
        <>
          <Button ref={cancelButtonRef} variant="ghost" type="button" onClick={() => close(false)}>
            {pending.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant="primary" type="button" onClick={() => close(true)}>
            {pending.confirmLabel ?? t('common.ok')}
          </Button>
        </>
      }
    />
  ) : null

  return { requestConfirm, confirmDialog }
}
