import {
  MANTA_BODY,
  MANTA_HORN_L,
  MANTA_HORN_R,
  MANTA_TAIL,
  MANTA_WING_L,
  MANTA_WING_R,
} from './manta-paths.js'
import { MANTA_STATUS_ANIMATION_MAP, type MantaStatus } from './manta-status-tokens.js'
import {
  MANTA_WIREFRAME_GLOW_OPACITY,
  useMantaAnimationStyles,
} from './use-manta-animation-styles.js'

interface MantaWireframeProps {
  status: MantaStatus
  size?: number
}

export function MantaWireframe({ status, size = 48 }: MantaWireframeProps) {
  const { swim, glow, glowColor } = MANTA_STATUS_ANIMATION_MAP[status]
  const swimMs = swim * 1000
  const glowMs = glow * 1000
  const { classes, cssText, scope } = useMantaAnimationStyles({
    size,
    swimMs,
    glowMs,
    glowOpacity: MANTA_WIREFRAME_GLOW_OPACITY,
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
        stroke={glowColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label={`Manta status: ${status}`}
      >
        <title>{`Manta status: ${status}`}</title>
        <defs>
          <filter id={`manta-wireframe-glow-${scope}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>

        {/* Blurred outline halo (pulsing) */}
        <g
          className={classes.glow}
          strokeWidth="1.2"
          filter={`url(#manta-wireframe-glow-${scope})`}
        >
          <g className={classes.finL}>
            <path d={MANTA_WING_L} />
          </g>
          <g className={classes.finR}>
            <path d={MANTA_WING_R} />
          </g>
          <path d={MANTA_BODY} />
        </g>

        {/* Crisp wireframe outline */}
        <g className={classes.finL}>
          <path d={MANTA_WING_L} strokeWidth="0.8" />
        </g>
        <g className={classes.finR}>
          <path d={MANTA_WING_R} strokeWidth="0.8" />
        </g>
        <path d={MANTA_BODY} strokeWidth="0.85" />
        <path d={MANTA_HORN_L} strokeWidth="0.8" />
        <path d={MANTA_HORN_R} strokeWidth="0.8" />
        <path d={MANTA_TAIL} strokeWidth="0.7" opacity="0.85" />

        {/* Interior spine + gill mesh (extra wireframe feel) */}
        <g opacity="0.4" strokeWidth="0.45">
          <path d="M 0 -9 L 0 8" />
          <path d="M -3.6 -2 Q 0 -1 3.6 -2" />
          <path d="M -3.4 2 Q 0 3 3.4 2" />
        </g>
      </svg>
    </div>
  )
}
