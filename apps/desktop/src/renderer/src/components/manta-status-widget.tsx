import type { AgentStatus, TaskStatus } from '@planetz/shared'
import { MantaAnim } from '../skins/manta/manta-anim'
import { MANTA_STATUS_ANIMATION_MAP, type MantaStatus } from '../skins/manta/manta-status-tokens.js'
import { useAppStore } from '../store/app-store'

function computeMantaStatus(
  agents: Array<{ status: AgentStatus }>,
  tasks: Array<{ status: TaskStatus }>,
): MantaStatus {
  const hasError =
    agents.some((a) => a.status === 'error') ||
    tasks.some((t) => t.status === 'failed' || t.status === 'exceeded')

  if (hasError) return 'error'

  const hasWorking =
    agents.some((a) => a.status === 'working' || a.status === 'reviewing') ||
    tasks.some((t) => t.status === 'running')

  if (hasWorking) return 'working'

  const hasWaiting = agents.some((a) => a.status === 'waiting')
  if (hasWaiting) return 'waiting'

  return 'idle'
}

export function MantaStatusWidget() {
  const counterPackEnabled = useAppStore((s) => s.counterPackEnabled)
  const state = useAppStore((s) => s.state)

  if (!counterPackEnabled || !state) {
    return null
  }

  const agents = state.agents ?? []
  const tasks = state.tasks ?? []
  const status = computeMantaStatus(agents, tasks)
  // LCD-equivalent text mirrors the device, and gives the state a non-color
  // label for screen readers / glanceable tooltip (design §8).
  const lcd = MANTA_STATUS_ANIMATION_MAP[status].lcd

  const glowColor = MANTA_STATUS_ANIMATION_MAP[status].glowColor

  return (
    <div
      className="flex flex-col items-center justify-center gap-0.5"
      role="status"
      aria-label={`Manta: ${lcd}`}
      title={lcd}
    >
      <MantaAnim status={status} size={40} />
      {/* On-screen LCD text — mirrors the device display (design §2.1). */}
      <span
        className="font-mono text-[9px] font-medium uppercase leading-none tracking-[0.12em]"
        style={{ color: glowColor }}
      >
        {lcd}
      </span>
    </div>
  )
}
