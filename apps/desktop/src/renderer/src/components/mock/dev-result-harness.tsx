import type { TaskResultBundle } from '@planetz/shared'
import { useEffect, useState } from 'react'
import { defaultSkin } from '../../skins/default-skin'
import { applySkinTokens } from '../../skins/registry'
import { TaskResultFullView } from '../task-result/task-result-full-view'

const LONG = Array.from(
  { length: 60 },
  (_, i) => `Line ${i + 1}: lorem ipsum dolor sit amet consectetur.`,
).join('\n')

const BUNDLE: TaskResultBundle = {
  taskId: 't_dev',
  runId: 'run-dev-0001',
  runDirSlug: '20260530-dev',
  runsDirRel: '.takt/runs',
  status: 'ok',
  primaryIndex: 0,
  reports: [
    {
      fileName: 'plan.md',
      relativePath: 'reports/plan.md',
      stepName: 'plan',
      formatKey: 'plan',
      content: `# Task Plan\n\n## Original Request\n現在の時刻は？\n\n## Decomposed Requirements\n\n| # | Requirement | Type | Notes |\n|---|-------------|------|-------|\n| 1 | Display the current time | Explicit | Direct question |\n| 2 | Time should be live/updating | Implicit | from #1 |\n\n## Objective\nImplement a feature to display the current time.\n\n${LONG}\n\n## End`,
    },
  ],
}

export function DevResultHarness() {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    applySkinTokens(document.documentElement, defaultSkin)
  }, [])
  return (
    <div className="h-screen overflow-hidden bg-[var(--color-background)] p-8 text-[var(--color-text)]">
      {/* Mimic PanelShell: backdrop-blur (containing block) + overflow-auto + bounded height */}
      <section className="flex h-[400px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 backdrop-blur-sm">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--color-accent)] px-3 py-2"
          >
            open
          </button>
          {open ? (
            <TaskResultFullView
              taskId={BUNDLE.taskId}
              taskTitle="現在の時刻は？"
              bundle={BUNDLE}
              initialIndex={0}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </div>
      </section>
    </div>
  )
}
