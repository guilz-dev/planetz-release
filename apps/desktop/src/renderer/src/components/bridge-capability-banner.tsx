import { useI18n } from '../i18n'

interface BridgeCapabilityBannerProps {
  missing: string[]
}

export function BridgeCapabilityBanner({ missing }: BridgeCapabilityBannerProps) {
  const { t } = useI18n()

  return (
    <div
      className="rounded-lg border border-[var(--color-status-failed)]/40 bg-[var(--color-panel)]/80 px-4 py-4"
      role="alert"
    >
      <p className="text-sm font-semibold text-[var(--color-status-failed)]">
        {t('bridge.capabilityGap.title')}
      </p>
      <p className="mt-2 text-xs text-[var(--color-muted-strong)]">
        {t('bridge.capabilityGap.body')}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-muted)]">
        <span className="font-medium text-[var(--color-text)]">
          {t('bridge.capabilityGap.methodsLabel')}
        </span>{' '}
        {missing.join(', ')}
      </p>
      <p className="mt-2 text-[11px] text-[var(--color-muted)]">
        {t('bridge.capabilityGap.devHint')}
      </p>
    </div>
  )
}
