import { useId, useMemo } from 'react'

export type MantaGlowOpacity = {
  min: number
  max: number
}

/** Default rim-glow pulse range for galaxy manta variants. */
export const MANTA_DEFAULT_GLOW_OPACITY: MantaGlowOpacity = { min: 0.45, max: 0.95 }

/** Wireframe variant uses a subtler glow pulse. */
export const MANTA_WIREFRAME_GLOW_OPACITY: MantaGlowOpacity = { min: 0.4, max: 0.85 }

export type MantaAnimationStyleConfig = {
  size: number
  swimMs: number
  glowMs: number
  glowOpacity?: MantaGlowOpacity
  sparkle?: boolean
}

export function useMantaAnimationStyles({
  size,
  swimMs,
  glowMs,
  glowOpacity = MANTA_DEFAULT_GLOW_OPACITY,
  sparkle = false,
}: MantaAnimationStyleConfig) {
  const scope = useId().replace(/:/g, '')
  const swimY = size * 0.15

  const classes = useMemo(
    () => ({
      body: `manta-body-${scope}`,
      finL: `manta-fin-l-${scope}`,
      finR: `manta-fin-r-${scope}`,
      glow: `manta-glow-${scope}`,
      sparkle: `manta-sparkle-${scope}`,
    }),
    [scope],
  )

  const cssText = useMemo(() => {
    const { min, max } = glowOpacity
    const sparkleCss = sparkle
      ? `
        @keyframes manta-sparkle-${scope} {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 1; }
        }
        .${classes.sparkle} {
          animation: manta-sparkle-${scope} ${glowMs}ms ease-in-out infinite;
        }`
      : ''

    return `
      @keyframes manta-swim-${scope} {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-${swimY}px); }
      }
      @keyframes manta-fin-l-${scope} {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(-9deg); }
      }
      @keyframes manta-fin-r-${scope} {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(9deg); }
      }
      @keyframes manta-glow-${scope} {
        0%, 100% { opacity: ${min}; }
        50% { opacity: ${max}; }
      }
      .${classes.body} {
        animation: manta-swim-${scope} ${swimMs}ms ease-in-out infinite;
      }
      .${classes.finL} {
        animation: manta-fin-l-${scope} ${swimMs}ms ease-in-out infinite;
        transform-origin: -1px -1px;
        transform-box: view-box;
      }
      .${classes.finR} {
        animation: manta-fin-r-${scope} ${swimMs}ms ease-in-out infinite;
        transform-origin: 1px -1px;
        transform-box: view-box;
      }
      .${classes.glow} {
        animation: manta-glow-${scope} ${glowMs}ms ease-in-out infinite;
      }${sparkleCss}
    `
  }, [
    scope,
    classes,
    swimY,
    swimMs,
    glowMs,
    glowOpacity.min,
    glowOpacity.max,
    sparkle,
    glowOpacity,
  ])

  return { classes, cssText, scope }
}
