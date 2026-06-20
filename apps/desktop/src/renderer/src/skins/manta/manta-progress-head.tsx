import { useId } from 'react'
import { MANTA_BODY, MANTA_WING_L, MANTA_WING_R } from './manta-paths.js'
import { MANTA_STATUS_ANIMATION_MAP, type MantaStatus } from './manta-status-tokens.js'

/**
 * Tiny progress marker for the "orbit" progress track (design §5.1 / §5.2).
 *
 * A small top-down manta silhouette held at a fixed point (the current step
 * node — §4.2 "top-down = symbol of state"), with one small planet dot orbiting
 * it (the agent circling its task — the orbit metaphor). Motion is local to the
 * node only (principle 4). Honours `prefers-reduced-motion` by parking the
 * orbiting dot. Colors follow the status token so it reads even at ~11px.
 */
interface MantaProgressHeadProps {
  /** Drives the glow color (defaults to the active "working" cyan). */
  status?: MantaStatus
  /** Manta silhouette size in px; the orbit box is ~1.7× this. */
  size?: number
}

export function MantaProgressHead({ status = 'working', size = 11 }: MantaProgressHeadProps) {
  const { glowColor } = MANTA_STATUS_ANIMATION_MAP[status]
  const scope = useId().replace(/:/g, '')
  const box = Math.round(size * 1.7)
  const planet = Math.max(1.5, size * 0.16)
  const cls = `mph-orbit-${scope}`

  const cssText = `
    @keyframes ${cls} {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .${cls} {
      animation: ${cls} 2.4s linear infinite;
      transform-origin: 50% 50%;
    }
    @media (prefers-reduced-motion: reduce) {
      .${cls} { animation: none; }
    }
  `

  return (
    <span
      className="relative inline-block shrink-0 align-middle"
      style={{ width: box, height: box }}
      aria-hidden="true"
    >
      <style>{cssText}</style>

      {/* Orbiting planet (the agent circling its task). */}
      <span className={`absolute inset-0 ${cls}`}>
        <span
          className="absolute rounded-full"
          style={{
            width: planet,
            height: planet,
            top: '50%',
            right: 0,
            transform: 'translateY(-50%)',
            background: glowColor,
            boxShadow: `0 0 ${planet * 1.5}px ${glowColor}`,
          }}
        />
      </span>

      {/* Centered top-down manta silhouette (stable symbol of the current step). */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg
          viewBox="-22 -16 44 32"
          width={size}
          height={size}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g fill={glowColor} opacity={0.92} stroke={glowColor} strokeWidth="1.2">
            <path d={MANTA_WING_L} />
            <path d={MANTA_WING_R} />
            <path d={MANTA_BODY} />
          </g>
        </svg>
      </span>
    </span>
  )
}
