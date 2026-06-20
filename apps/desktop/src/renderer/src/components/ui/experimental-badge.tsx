interface ExperimentalBadgeProps {
  className?: string
  /** Render abbreviated label ("EXP") for narrow containers. */
  short?: boolean
}

export function ExperimentalBadge({ className = '', short = false }: ExperimentalBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400 ${className}`}
      title="v0.3 experimental — not required for v0.2 acceptance"
    >
      {short ? 'Exp' : 'Experimental'}
    </span>
  )
}
