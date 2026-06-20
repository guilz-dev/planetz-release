import { useI18n } from '../i18n'
import { getExecutionAnalyticsBridgeGap } from '../lib/orbit-bridge-guard'

export function BridgeRevisionDevBanner() {
  const { t } = useI18n()

  if (!import.meta.env.DEV) return null
  if (getExecutionAnalyticsBridgeGap().length > 0) return null
  if (window.orbitMeta?.revision === __BRIDGE_REVISION__) return null

  return (
    <div
      className="border-b border-[var(--color-status-exceeded)]/40 bg-[var(--color-status-exceeded-soft)] px-3 py-2 text-[11px] text-[var(--color-status-exceeded)]"
      role="status"
    >
      <p className="font-semibold text-[var(--color-text)]">{t('bridge.revisionMismatch.title')}</p>
      <p className="mt-0.5 text-[var(--color-muted-strong)]">{t('bridge.revisionMismatch.body')}</p>
    </div>
  )
}
