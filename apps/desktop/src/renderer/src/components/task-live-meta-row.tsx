import type { ExecutorState, TaskViewModel } from '@planetz/shared'
import { Sparkles, Timer } from 'lucide-react'
import { useI18n } from '../i18n'
import { formatElapsed } from '../lib/format-elapsed'
import {
  describePersonaAttributionSource,
  resolveExecutorDisplay,
} from '../lib/task-execution-display'

export interface TaskLiveMetaRowProps {
  task: TaskViewModel
  executors: ExecutorState[]
  elapsedMs: number
}

export function TaskLiveMetaRow({ task, executors, elapsedMs }: TaskLiveMetaRowProps) {
  const { t } = useI18n()
  const attribution = task.executorAttribution
  const { label: executorLabel, ariaLabel: executorAriaLabel } = resolveExecutorDisplay(
    task,
    executors,
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)]/50 pt-2 text-[11px] text-[var(--color-muted-strong)]">
      <span
        className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--color-text)]"
        title={t('panels.running.elapsedAria')}
      >
        <Timer size={11} className="text-[var(--color-status-running)]" />
        {formatElapsed(elapsedMs)}
      </span>
      {executorLabel ? (
        <span
          className="inline-flex items-center gap-1 text-[var(--color-muted-strong)]"
          title={executorAriaLabel}
        >
          <Sparkles size={11} className="text-[var(--color-accent)]" />
          <span className="text-[var(--color-text)]">{executorLabel}</span>
          {attribution?.persona ? (
            <span
              className="text-[var(--color-muted)]"
              title={describePersonaAttributionSource(attribution.personaSource)}
            >
              · {attribution.persona}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
