import type { IntegrationAdapterId } from '@planetz/shared'
import { useCallback, useState } from 'react'
import { useI18n } from '../i18n'
import { toErrorMessage } from '../lib/to-error-message.js'
import { usePushToast } from './use-toast'

export function useIntegrationActions() {
  const [hookBearerSecret, setHookBearerSecret] = useState<string | null>(null)
  const pushToast = usePushToast()
  const { t } = useI18n()

  const toggleHookServer = useCallback(
    async (input: { enabled: boolean; port?: number }) => {
      try {
        const result = await window.orbit.toggleHookServer(input)
        if (result.bearerSecret) {
          setHookBearerSecret(result.bearerSecret)
        }
        if (!input.enabled) {
          setHookBearerSecret(null)
        }
        return result
      } catch (error) {
        if (input.enabled) {
          pushToast({
            kind: 'error',
            title: t('settings.integrations.hookStartFailed.title'),
            message: t('settings.integrations.hookStartFailed.message', {
              detail: toErrorMessage(error, 'Failed to start hook server'),
            }),
          })
        }
        throw error
      }
    },
    [pushToast, t],
  )

  const toggleAdapter = useCallback(async (id: IntegrationAdapterId, enabled: boolean) => {
    await window.orbit.toggleAdapter({ id, enabled })
  }, [])

  const pushAdapter = useCallback(async (id: IntegrationAdapterId) => {
    await window.orbit.pushExternalAgent({ id })
  }, [])

  return {
    hookBearerSecret,
    setHookBearerSecret,
    toggleHookServer,
    toggleAdapter,
    pushAdapter,
  }
}
