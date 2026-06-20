import type { TaskReportArtifact } from '@planetz/shared'
import { useI18n } from '../../i18n'

interface SpecArtifactsPanelProps {
  artifacts: TaskReportArtifact[]
  artifactsLoading: boolean
  artifactsError: string | null
  artifactTaskId: string | null
}

export function SpecArtifactsPanel({
  artifacts,
  artifactsLoading,
  artifactsError,
  artifactTaskId,
}: SpecArtifactsPanelProps) {
  const { t } = useI18n()

  return (
    <section className="flex max-h-[40%] min-h-[140px] shrink-0 flex-col overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-panel)]/40">
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-strong)]">
          {t('specStudio.artifactsTitle')}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        {artifactsLoading ? (
          <p className="text-[var(--color-muted)]">{t('specStudio.artifactsLoading')}</p>
        ) : null}
        {artifactsError ? <p className="text-[var(--color-alert)]">{artifactsError}</p> : null}
        {!artifactsLoading && !artifactsError && !artifactTaskId ? (
          <p className="text-[var(--color-muted)]">{t('specStudio.artifactsEmpty')}</p>
        ) : null}
        {!artifactsLoading && artifactTaskId ? (
          <p className="mb-2 text-[var(--color-muted)]">
            {t('specStudio.artifactsTask', { taskId: artifactTaskId })}
          </p>
        ) : null}
        <ul className="space-y-2">
          {artifacts.map((artifact) => (
            <li
              key={artifact.relativePath}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-2"
            >
              <p className="font-mono text-[11px] text-[var(--color-text-strong)]">
                {artifact.fileName}
              </p>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-[var(--color-text)]">
                {artifact.content}
              </pre>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
