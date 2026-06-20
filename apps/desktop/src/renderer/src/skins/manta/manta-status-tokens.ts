// Manta status tokens — the single source of truth for the "state language"
// shared by the physical Manta device (LCD text × ambient light) and the app UI.
// See docs/design/manta-mode-ui-design.md §2.1 / §4.1.

/**
 * Live states emitted by `computeMantaStatus()` today.
 *
 * Forward-compat (design §4.1): the full device vocabulary is 6 states —
 * `listening` (PTT/voice) and a split of approval into
 * `approve_routine` (green) / `approve_review` (orange). Both are deferred:
 * there is no canonical upstream data to distinguish them yet. Adding them is
 * purely additive — extend {@link MantaStateLanguage}, give them an entry in the
 * map below, and teach `computeMantaStatus()` to emit them.
 */
export type MantaStatus = 'idle' | 'working' | 'waiting' | 'error'

/** The full device state language (§4.1), incl. states not yet emitted. */
export type MantaStateLanguage = MantaStatus | 'listening' | 'approve_routine' | 'approve_review'

export interface MantaStatusToken {
  /** Swim animation duration (s). Lower = more active. */
  swim: number
  /** Glow pulse duration (s). Lower = faster breathing. */
  glow: number
  /** Rim-glow / ambient ring color — mirrors the device ambient light. */
  glowColor: string
  /**
   * LCD-equivalent text (device canon, intentionally English/uppercase).
   * Paired with `glowColor` so state is never communicated by color alone (§8).
   */
  lcd: string
}

export const MANTA_STATUS_ANIMATION_MAP: Record<MantaStatus, MantaStatusToken> = {
  idle: {
    swim: 3.2,
    glow: 2.4,
    glowColor: 'var(--color-muted-strong)',
    lcd: 'IDLE',
  },
  working: {
    swim: 1.0,
    glow: 0.7,
    glowColor: 'var(--color-status-running)',
    lcd: 'PROCESSING…',
  },
  waiting: {
    // Maps to the device "APPROVE?" / safe-approval ambient (green).
    swim: 2.0,
    glow: 1.6,
    glowColor: 'var(--color-status-completed)',
    lcd: 'APPROVE?',
  },
  error: {
    swim: 0.45,
    glow: 0.4,
    glowColor: 'var(--color-status-failed)',
    lcd: 'ERROR · BLOCKED',
  },
}
