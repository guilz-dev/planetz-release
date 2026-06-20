/**
 * Manta GIF/PNG assets live under `apps/desktop/public/` (see `pnpm generate:manta-*`).
 * They are separate from renderer `src/renderer/public/` (favicon, etc.).
 *
 * Use Vite `?url` imports — not `rendererPublicUrl` (that targets renderer `public/` only).
 */
import mantaOrbitApproveReviewGif from '../../../../../public/manta-orbit-approve_review.gif?url'
import mantaOrbitApproveRoutineGif from '../../../../../public/manta-orbit-approve_routine.gif?url'
import mantaOrbitErrorGif from '../../../../../public/manta-orbit-error.gif?url'
import mantaOrbitIdleGif from '../../../../../public/manta-orbit-idle.gif?url'
import mantaOrbitListeningGif from '../../../../../public/manta-orbit-listening.gif?url'
import mantaOrbitWaitingGif from '../../../../../public/manta-orbit-waiting.gif?url'
import mantaOrbitWorkingGif from '../../../../../public/manta-orbit-working.gif?url'
import mantaOrbitWorkingPng from '../../../../../public/manta-orbit-working.png?url'
import mantaSwimDefaultGif from '../../../../../public/manta-swim-default.gif?url'
import mantaSwimShimmerGif from '../../../../../public/manta-swim-shimmer.gif?url'
import mantaSwimWireframeGif from '../../../../../public/manta-swim-wireframe.gif?url'
import type { MantaStateLanguage, MantaStatus } from './manta-status-tokens.js'

const MANTA_ORBIT_GIF_BY_STATE: Record<MantaStateLanguage, string> = {
  idle: mantaOrbitIdleGif,
  listening: mantaOrbitListeningGif,
  working: mantaOrbitWorkingGif,
  waiting: mantaOrbitWaitingGif,
  approve_routine: mantaOrbitApproveRoutineGif,
  approve_review: mantaOrbitApproveReviewGif,
  error: mantaOrbitErrorGif,
}

/** Orbit GIF for the swim-strip idle bar. */
export function mantaOrbitIdleGifUrl(): string {
  return MANTA_ORBIT_GIF_BY_STATE.idle
}

/** Static orbit emblem for the swim-strip "No mantas swimming" bar. */
export function mantaOrbitWorkingPngUrl(): string {
  return mantaOrbitWorkingPng
}

/** Top-down orbit GIF for a live Manta status. */
export function mantaOrbitGifUrl(status: MantaStatus): string {
  return MANTA_ORBIT_GIF_BY_STATE[status]
}

/** Top-down orbit GIF for the full device state language (§4.1). */
export function mantaOrbitStateGifUrl(status: MantaStateLanguage): string {
  return MANTA_ORBIT_GIF_BY_STATE[status]
}

const MANTA_SWIM_GIF_BY_VARIANT = {
  default: mantaSwimDefaultGif,
  shimmer: mantaSwimShimmerGif,
  wireframe: mantaSwimWireframeGif,
} as const

/** Right-swim GIF variant. */
export function mantaSwimGifUrl(
  variant: keyof typeof MANTA_SWIM_GIF_BY_VARIANT = 'default',
): string {
  return MANTA_SWIM_GIF_BY_VARIANT[variant]
}
