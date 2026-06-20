import { useId } from 'react'
import {
  MANTA_BODY,
  MANTA_HORN_L,
  MANTA_HORN_R,
  MANTA_STARS,
  MANTA_TAIL,
  MANTA_WING_L,
  MANTA_WING_R,
} from './manta-paths.js'
import { MANTA_STATUS_ANIMATION_MAP, type MantaStatus } from './manta-status-tokens.js'

/**
 * SVG + CSS version of the right-swimming "glide" manta (cf. the prototyped
 * `manta-glide-*.gif`). The manta faces +X and is shown from a ~30° tilted 3/4
 * side angle; it swims in place with a forward surge + wing flap + rim-glow
 * pulse. No scrolling background (kept deliberately simple — direction reads
 * from the orientation and forward surge alone).
 *
 * Theme-following (colors come from CSS vars), crisp at any size, and honours
 * `prefers-reduced-motion`. Geometry is shared with `manta-anim.tsx` via
 * `manta-paths.ts`; status → color/speed via `manta-status-tokens.ts`.
 */

// Static 3/4 view: head → +X (right) with a ~30° downward tilt. Matches the
// proven GIF transform (SVG applies right-to-left: rotate first, then skew,
// then foreshorten the now-vertical wing span).
const VIEW_TRANSFORM = 'scale(1 0.55) skewX(-12) rotate(90)'

interface MantaGlideProps {
  status: MantaStatus
  /** Box height in px; width is derived from the landscape view (1.5×). */
  height?: number
}

export function MantaGlide({ status, height = 36 }: MantaGlideProps) {
  const { swim, glow, glowColor } = MANTA_STATUS_ANIMATION_MAP[status]
  const swimMs = swim * 1000
  const glowMs = glow * 1000
  const width = Math.round(height * 1.5)
  const scope = useId().replace(/:/g, '')

  // Surge distance scales with size; small, gentle forward thrust.
  const surge = Math.max(1.5, height * 0.08)

  const cls = {
    surge: `mg-surge-${scope}`,
    finL: `mg-fin-l-${scope}`,
    finR: `mg-fin-r-${scope}`,
    glow: `mg-glow-${scope}`,
  }

  const cssText = `
    @keyframes mg-surge-${scope} {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(${surge}px, -${(surge * 0.4).toFixed(2)}px); }
    }
    @keyframes mg-fin-l-${scope} {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(-9deg); }
    }
    @keyframes mg-fin-r-${scope} {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(9deg); }
    }
    @keyframes mg-glow-${scope} {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.95; }
    }
    .${cls.surge} {
      animation: mg-surge-${scope} ${swimMs}ms ease-in-out infinite;
    }
    .${cls.finL} {
      animation: mg-fin-l-${scope} ${swimMs}ms ease-in-out infinite;
      transform-origin: -1px -1px;
      transform-box: view-box;
    }
    .${cls.finR} {
      animation: mg-fin-r-${scope} ${swimMs}ms ease-in-out infinite;
      transform-origin: 1px -1px;
      transform-box: view-box;
    }
    .${cls.glow} {
      animation: mg-glow-${scope} ${glowMs}ms ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .${cls.surge}, .${cls.finL}, .${cls.finR}, .${cls.glow} {
        animation: none;
      }
      .${cls.glow} { opacity: 0.85; }
    }
  `

  return (
    <div className="inline-flex items-center justify-center" style={{ width, height }}>
      <style>{cssText}</style>
      <svg
        className={cls.surge}
        viewBox="-24 -16 48 32"
        width={width}
        height={height}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label={`Manta status: ${status}`}
      >
        <title>{`Manta status: ${status}`}</title>
        <defs>
          <filter id={`mg-glow-f-${scope}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
          <radialGradient id={`mg-galaxy-${scope}`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="var(--color-cat-panel)" />
            <stop offset="100%" stopColor="var(--color-cat-crust)" />
          </radialGradient>
        </defs>

        {/* Everything tilts to the right-facing 3/4 view. */}
        <g transform={VIEW_TRANSFORM}>
          {/* Status-colored rim glow (blurred outline that pulses) */}
          <g
            className={cls.glow}
            fill="none"
            stroke={glowColor}
            strokeWidth="1.4"
            filter={`url(#mg-glow-f-${scope})`}
          >
            <g className={cls.finL}>
              <path d={MANTA_WING_L} />
            </g>
            <g className={cls.finR}>
              <path d={MANTA_WING_R} />
            </g>
            <path d={MANTA_BODY} />
            <path d={MANTA_HORN_L} />
            <path d={MANTA_HORN_R} />
            <path d={MANTA_TAIL} strokeWidth="1.1" />
          </g>

          {/* Solid galaxy body with crisp glowing edge */}
          <g fill={`url(#mg-galaxy-${scope})`} stroke={glowColor} strokeWidth="0.7">
            <g className={cls.finL}>
              <path d={MANTA_WING_L} />
            </g>
            <g className={cls.finR}>
              <path d={MANTA_WING_R} />
            </g>
            <path d={MANTA_BODY} />
          </g>

          {/* Starfield speckle on the body (galaxy finish) */}
          <g fill="var(--color-text)">
            {MANTA_STARS.map((s) => (
              <circle key={`${s.cx},${s.cy}`} cx={s.cx} cy={s.cy} r={s.r} opacity={s.o} />
            ))}
          </g>

          {/* Cephalic horns + tail — glowing edges */}
          <g fill="none" stroke={glowColor} strokeWidth="0.7">
            <path d={MANTA_HORN_L} />
            <path d={MANTA_HORN_R} />
            <path d={MANTA_TAIL} strokeWidth="0.56" opacity="0.85" />
          </g>
        </g>
      </svg>
    </div>
  )
}
