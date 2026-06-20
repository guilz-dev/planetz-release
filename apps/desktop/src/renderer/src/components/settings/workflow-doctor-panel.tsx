import type { WorkflowDiagnostic } from '@planetz/shared'
import { ORBIT_DISPLAY_NAME } from '@planetz/shared'
import { AlertTriangle, Check, Info, XCircle } from 'lucide-react'
import { cn } from '../ui/cn'

interface WorkflowDoctorPanelProps {
  diagnostics: WorkflowDiagnostic[] | null
  loading: boolean
}

const ICON = {
  error: <XCircle size={13} />,
  warn: <AlertTriangle size={13} />,
  info: <Info size={13} />,
}

const TONE_BG: Record<WorkflowDiagnostic['level'], string> = {
  error: 'bg-[var(--color-status-failed-soft)] text-[var(--color-status-failed)]',
  warn: 'bg-[var(--color-status-exceeded-soft)] text-[var(--color-status-exceeded)]',
  info: 'bg-[var(--color-status-pending-soft)] text-[var(--color-muted-strong)]',
}

export function WorkflowDoctorPanel({ diagnostics, loading }: WorkflowDoctorPanelProps) {
  if (loading) {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        Running {ORBIT_DISPLAY_NAME} workflow doctor…
      </p>
    )
  }
  if (!diagnostics) {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        Validate the workflow to see {ORBIT_DISPLAY_NAME} workflow doctor results here.
      </p>
    )
  }
  if (diagnostics.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-status-completed-soft)] px-2 py-1 text-xs text-[var(--color-status-completed)]">
        <Check size={13} /> doctor reports no findings
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {diagnostics.map((d, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics list is replaced wholesale on each validate
          key={i}
          className={cn(
            'flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs',
            TONE_BG[d.level],
          )}
        >
          <span className="mt-0.5 shrink-0">{ICON[d.level]}</span>
          <div className="min-w-0 flex-1">
            <p>{d.message}</p>
            {d.code ? (
              <p className="mt-0.5 font-mono text-[10px] opacity-70">code: {d.code}</p>
            ) : null}
            {d.path ? (
              <p className="mt-0.5 truncate font-mono text-[10px] opacity-70">{d.path}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
