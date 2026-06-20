import {
  MANTA_BODY,
  MANTA_HORN_L,
  MANTA_HORN_R,
  MANTA_TAIL,
  MANTA_WING_L,
  MANTA_WING_R,
} from './manta-paths.js'
import { MANTA_STATUS_ANIMATION_MAP, type MantaStatus } from './manta-status-tokens.js'
import { useMantaAnimationStyles } from './use-manta-animation-styles.js'

interface MantaShimmerProps {
  status: MantaStatus
  size?: number
}

/** Sparkle positions orbiting the body (galaxy shimmer). */
const SPARKLES = [
  { cx: -9, cy: -5, r: 1.1 },
  { cx: 9, cy: -4, r: 0.85 },
  { cx: -7, cy: 6, r: 0.9 },
  { cx: 8, cy: 6.5, r: 0.75 },
  { cx: 0, cy: -12.5, r: 0.7 },
  { cx: 13, cy: 0, r: 0.6 },
  { cx: -13, cy: 1, r: 0.6 },
]

export function MantaShimmer({ status, size = 48 }: MantaShimmerProps) {
  const { swim, glow, glowColor } = MANTA_STATUS_ANIMATION_MAP[status]
  const swimMs = swim * 1000
  const glowMs = glow * 1000
  const { classes, cssText, scope } = useMantaAnimationStyles({
    size,
    swimMs,
    glowMs,
    sparkle: true,
  })

  return (
    <div
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
      }}
    >
      <style>{cssText}</style>

      <svg
        className={classes.body}
        viewBox="-22 -16 44 32"
        width={size}
        height={size}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label={`Manta status: ${status}`}
      >
        <title>{`Manta status: ${status}`}</title>
        <defs>
          <filter id={`manta-glow-shimmer-${scope}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
          {/* Galaxy body: dark navy core fading to a deeper edge (starfield finish) */}
          <radialGradient id={`manta-galaxy-shimmer-${scope}`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="var(--color-cat-panel)" />
            <stop offset="100%" stopColor="var(--color-cat-crust)" />
          </radialGradient>
        </defs>

        {/* Sparkles orbiting the body */}
        <g className={classes.sparkle} fill={glowColor}>
          {SPARKLES.map((s) => (
            <circle key={`${s.cx},${s.cy}`} cx={s.cx} cy={s.cy} r={s.r} />
          ))}
        </g>

        {/* Status-colored rim glow (blurred outline that pulses) */}
        <g
          className={classes.glow}
          fill="none"
          stroke={glowColor}
          strokeWidth="1.4"
          filter={`url(#manta-glow-shimmer-${scope})`}
        >
          <g className={classes.finL}>
            <path d={MANTA_WING_L} />
          </g>
          <g className={classes.finR}>
            <path d={MANTA_WING_R} />
          </g>
          <path d={MANTA_BODY} />
          <path d={MANTA_HORN_L} />
          <path d={MANTA_HORN_R} />
          <path d={MANTA_TAIL} strokeWidth="1.1" />
        </g>

        {/* Solid galaxy body with crisp glowing edge */}
        <g fill={`url(#manta-galaxy-shimmer-${scope})`} stroke={glowColor} strokeWidth="0.7">
          <g className={classes.finL}>
            <path d={MANTA_WING_L} />
          </g>
          <g className={classes.finR}>
            <path d={MANTA_WING_R} />
          </g>
          <path d={MANTA_BODY} />
        </g>

        {/* Cephalic horns + tail — glowing edges */}
        <g fill="none" stroke={glowColor} strokeWidth="0.7">
          <path d={MANTA_HORN_L} />
          <path d={MANTA_HORN_R} />
          <path d={MANTA_TAIL} strokeWidth="0.56" opacity="0.85" />
        </g>
      </svg>
    </div>
  )
}
