import { useId, useMemo } from 'react'
import { MantaGlide } from './manta-glide.js'
import { mantaOrbitWorkingPngUrl } from './manta-public-assets.js'
import type { MantaStatus } from './manta-status-tokens.js'

/** Orbit working emblem beside the swim-strip idle label. */
function MantaRestIcon() {
  return (
    <img
      src={mantaOrbitWorkingPngUrl()}
      alt=""
      aria-hidden="true"
      width={30}
      height={30}
      draggable={false}
      className="-my-1 shrink-0 select-none"
    />
  )
}

/**
 * Swim strip — a single row above the task list where each active task is a
 * manta swimming in space toward the Planetz core (the controlling hub / goal).
 *
 * - x position = step progress (0 left → 1 at the core). Advancing a step makes
 *   the manta glide to its new position.
 * - overlap is resolved by depth lanes + parallax (front = larger/brighter,
 *   back = smaller/dimmer) so mantas at the same progress never collide.
 * - identity = an always-on short label (task id) + selection ring; clicking a
 *   manta selects its task.
 * - collapses to a thin bar when nothing is running (kept, not removed).
 *
 * Design: docs/design/manta-mode-ui-design.md + [[manta-mode-design-direction]].
 */
export interface MantaSwimmer {
  id: string
  /** Short identity label (task id). */
  label: string
  status: MantaStatus
  /** 0..1 step progress. */
  progress: number
}

interface MantaSwimStripProps {
  swimmers: MantaSwimmer[]
  selectedId?: string
  onSelect?: (id: string) => void
}

const EXPANDED = 96
const LANES = 4
const BAND_TOP = 10
const BAND_H = EXPANDED - BAND_TOP - 22 // leave room for labels under mantas

function shortLabel(id: string): string {
  const seg = id.includes('/') ? (id.split('/').at(-1) ?? id) : id
  return seg.length > 12 ? `${seg.slice(0, 11)}…` : seg
}

// Deterministic star positions (percent), stable across renders.
function useStars(seed: number) {
  return useMemo(() => {
    let s = seed
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
    return Array.from({ length: 42 }, () => ({
      x: rnd() * 100,
      y: rnd() * 100,
      r: rnd() * 1.1 + 0.2,
      o: rnd() * 0.4 + 0.05,
    }))
  }, [seed])
}

export function MantaSwimStrip({ swimmers, selectedId, onSelect }: MantaSwimStripProps) {
  const scope = useId().replace(/:/g, '')
  const stars = useStars(7)
  const active = swimmers.length

  // Collapsed state (nothing running): a clean, centered slim bar — no
  // starfield, no clipping. Kept (not removed) so the squad always has a home.
  if (active === 0) {
    return (
      <div
        className="flex h-7 items-center gap-2 rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[0.06] px-3"
        role="group"
        aria-label="No mantas swimming"
      >
        <MantaRestIcon />
        <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--color-muted-strong)]">
          No mantas swimming
        </span>
      </div>
    )
  }

  const css = `
    .mss-${scope} .mss-swimmer{transition:left 1.2s cubic-bezier(.4,0,.2,1);cursor:pointer}
    .mss-${scope} .mss-mg{transition:transform .18s ease, filter .18s ease}
    .mss-${scope} .mss-swimmer:hover{z-index:30}
    .mss-${scope} .mss-swimmer:hover .mss-mg{transform:scale(1.4);filter:drop-shadow(0 0 6px currentColor)}
    .mss-${scope} .mss-sel .mss-mg{filter:drop-shadow(0 0 5px currentColor)}
    @keyframes mss-spin-${scope}{to{transform:rotate(360deg)}}
    @keyframes mss-pulse-${scope}{0%,100%{opacity:.5}50%{opacity:.9}}
    @media (prefers-reduced-motion: reduce){
      .mss-${scope} .mss-swimmer{transition:none}
    }
  `

  return (
    <div
      className={`mss-${scope} relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-crust)]/60`}
      style={{ height: EXPANDED }}
      role="group"
      aria-label={`Active squad: ${active} swimming`}
    >
      <style>{css}</style>

      {/* starfield */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {stars.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[var(--color-text)]"
            style={{
              left: `${st.x}%`,
              top: `${st.y}%`,
              width: st.r * 2,
              height: st.r * 2,
              opacity: st.o,
            }}
          />
        ))}
      </div>

      {/* header label */}
      <div className="pointer-events-none absolute left-3 top-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--color-muted-strong)]">
        ACTIVE SQUAD
      </div>
      <div className="pointer-events-none absolute left-3 top-[22px] font-mono text-[11px] text-[var(--color-muted)]">
        {active} swimming
      </div>

      {/* swim track (between label area and the core) */}
      <div className="absolute inset-y-0" style={{ left: 110, right: 70 }}>
        {swimmers.map((sw, i) => {
          const lane = i % LANES
          const dd = LANES > 1 ? lane / (LANES - 1) : 0 // 0 front .. 1 back
          const mh = Math.round(30 - dd * 11)
          const op = 1 - dd * 0.45
          const pct = Math.min(0.96, Math.max(0.02, sw.progress))
          const y = BAND_TOP + (lane + 0.5) * (BAND_H / LANES) - mh / 2 + ((i * 7) % 9) - 4
          const selected = sw.id === selectedId
          return (
            <button
              type="button"
              key={sw.id}
              className={`mss-swimmer absolute flex flex-col items-center border-0 bg-transparent p-0 ${selected ? 'mss-sel' : ''}`}
              style={{
                left: `${pct * 100}%`,
                top: y,
                transform: 'translateX(-50%)',
                opacity: op,
                zIndex: 3 + (LANES - lane),
                color: 'var(--color-status-running)',
              }}
              title={`${sw.label} · ${Math.round(sw.progress * 100)}%`}
              aria-label={`${sw.label}, ${Math.round(sw.progress * 100)}% — select task`}
              onClick={() => onSelect?.(sw.id)}
            >
              <span className="mss-mg">
                <MantaGlide status={sw.status} height={mh} />
              </span>
              <span
                className="mt-0.5 font-mono text-[9px] font-semibold tracking-[0.04em] whitespace-nowrap text-[var(--color-status-running)]"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9)' }}
              >
                {shortLabel(sw.label)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Planetz core (goal) */}
      <div
        className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <svg width="40" height="40" viewBox="0 0 44 44">
          <g
            style={{
              transformOrigin: '22px 22px',
              animation: `mss-spin-${scope} 18s linear infinite`,
            }}
          >
            <ellipse
              cx="22"
              cy="22"
              rx="20"
              ry="7"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1"
              opacity="0.4"
            />
          </g>
          <circle
            cx="22"
            cy="22"
            r="9"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.4"
            style={{ animation: `mss-pulse-${scope} 2.4s ease-in-out infinite` }}
          />
          <circle cx="22" cy="22" r="3.4" fill="var(--color-accent)" />
        </svg>
      </div>
      <div className="pointer-events-none absolute right-3 bottom-1 font-mono text-[9px] font-semibold tracking-[0.14em] text-[var(--color-accent)] opacity-80">
        Manta mode
      </div>
    </div>
  )
}
