export interface PersonaOutline {
  title?: string
  do: string[]
  dont: string[]
  principles: string[]
  hasStructure: boolean
}

export function parsePersonaOutline(content: string): PersonaOutline {
  const lines = content.split('\n')
  const r: PersonaOutline = { do: [], dont: [], principles: [], hasStructure: false }
  let section: 'none' | 'do' | 'dont' | 'principles' = 'none'
  for (const line of lines) {
    if (!r.title) {
      const t = line.match(/^#\s+(.+)/)
      if (t) {
        r.title = t[1].trim()
        continue
      }
    }
    if (/^##\s+(Behavioral\s+Principles|行動原則)/i.test(line)) {
      section = 'principles'
      r.hasStructure = true
      continue
    }
    if (/^##\s+(Role\s+Boundaries|役割境界|役割の境界)/i.test(line)) {
      section = 'none'
      r.hasStructure = true
      continue
    }
    if (/^##\s/.test(line)) {
      section = 'none'
      continue
    }
    if (/^\*\*Do:?\*\*/i.test(line)) {
      section = 'do'
      r.hasStructure = true
      continue
    }
    if (/^\*\*Don['’]?t:?\*\*/i.test(line)) {
      section = 'dont'
      r.hasStructure = true
      continue
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/)
    if (bullet && section !== 'none') {
      const text = bullet[1].trim().replace(/^\*\*([^*]+)\*\*\s*[—-]?\s*/, '$1 — ')
      if (section === 'do') r.do.push(text)
      else if (section === 'dont') r.dont.push(text)
      else if (section === 'principles') r.principles.push(text)
    }
  }
  return r
}

interface PersonaOutlinePreviewProps {
  outline: PersonaOutline
  className?: string
}

export function PersonaOutlinePreview({ outline, className }: PersonaOutlinePreviewProps) {
  if (!outline.hasStructure) {
    return (
      <div
        className={`rounded-md border border-dashed border-[var(--color-border)] p-3 text-[11px] text-[var(--color-muted)] ${className ?? ''}`}
      >
        <p className="font-medium text-[var(--color-muted-strong)]">Custom format</p>
        <p className="mt-1">
          Standard headings (<span className="font-mono">## Role Boundaries</span>,{' '}
          <span className="font-mono">## Behavioral Principles</span>) not detected. Outline preview
          is unavailable.
        </p>
      </div>
    )
  }
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/30 p-3 text-[11px] ${className ?? ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Persona outline
      </p>
      {outline.title ? (
        <p className="text-xs font-semibold text-[var(--color-text-strong)]">{outline.title}</p>
      ) : null}
      {outline.do.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-status-completed)]">
            Do
          </p>
          <ul className="ml-3 list-disc space-y-0.5 text-[var(--color-text)]">
            {outline.do.map((t, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: derived from markdown order
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {outline.dont.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-status-failed)]">
            Don&apos;t
          </p>
          <ul className="ml-3 list-disc space-y-0.5 text-[var(--color-text)]">
            {outline.dont.map((t, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: derived from markdown order
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {outline.principles.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Principles
          </p>
          <ul className="ml-3 list-disc space-y-0.5 text-[var(--color-text)]">
            {outline.principles.map((t, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: derived from markdown order
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
