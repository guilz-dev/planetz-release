import { PRODUCT_DISPLAY_NAME } from '@planetz/shared'
import { Loader2 } from 'lucide-react'
import { ProductBrandIcon } from './product-brand-icon'

interface AppBootScreenProps {
  /** Localized status line shown under the brand (e.g. "Restoring workspace…"). */
  status: string
}

/**
 * Full-window app start screen shown while the main process restores the last
 * workspace and the renderer hydrates. It covers the entire bootstrap window so
 * the onboarding wizard never flashes before we know whether a workspace exists.
 *
 * Uses the app base surface (matches the BrowserWindow `backgroundColor`) so the
 * first paint has no flash from the native background to this screen.
 */
export function AppBootScreen({ status }: AppBootScreenProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex h-full w-full select-none flex-col items-center justify-center gap-8 bg-[var(--color-surface)] text-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-3xl bg-[var(--color-accent-soft)] blur-2xl motion-safe:animate-pulse"
          />
          <ProductBrandIcon className="relative" />
        </div>
        <p className="text-xl font-semibold tracking-tight text-[var(--color-text-strong)]">
          {PRODUCT_DISPLAY_NAME}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[var(--color-muted)]">
        <Loader2
          size={16}
          aria-hidden
          className="animate-spin text-[var(--color-accent)] motion-reduce:animate-none"
        />
        <span className="text-sm">{status}</span>
      </div>
    </div>
  )
}
