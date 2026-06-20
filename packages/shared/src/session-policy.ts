import {
  type OrbitInteractiveToolsProfile,
  type PlanetzSessionPolicy,
  resolveOrbitInteractiveToolsProfile,
} from './orbit-interactive-contract.js'

export type { PlanetzSessionPolicy } from './orbit-interactive-contract.js'
export { planetzSessionPolicySchema } from './orbit-interactive-contract.js'

export type ChatSessionMode = 'interactive' | 'spec' | 'agent'

const DEFAULT_SESSION_POLICY = 'planetz-task-planning' satisfies PlanetzSessionPolicy

export function resolveSessionPolicy(input: {
  sessionPolicy?: PlanetzSessionPolicy | undefined
}): PlanetzSessionPolicy {
  return input.sessionPolicy ?? DEFAULT_SESSION_POLICY
}

export function sessionPolicyFromChatMode(mode: ChatSessionMode): PlanetzSessionPolicy {
  if (mode === 'spec') return 'planetz-chat-spec'
  if (mode === 'agent') return 'planetz-chat-agent'
  return 'planetz-chat-investigate'
}

export function chatSessionPolicyToChatMode(
  policy: PlanetzSessionPolicy | undefined,
): ChatSessionMode {
  if (policy === 'planetz-chat-spec') return 'spec'
  if (policy === 'planetz-chat-agent') return 'agent'
  return 'interactive'
}

export function resolveSessionToolsProfile(input: {
  sessionPolicy: PlanetzSessionPolicy
  toolsProfile?: OrbitInteractiveToolsProfile | undefined
}): OrbitInteractiveToolsProfile {
  if (input.toolsProfile) return input.toolsProfile
  switch (input.sessionPolicy) {
    case 'planetz-chat-investigate':
      return 'planetz-investigate'
    case 'planetz-chat-spec':
      return 'planetz-readonly'
    case 'planetz-chat-agent':
      return 'planetz-agent-edit'
    default: {
      const envFallback = resolveOrbitInteractiveToolsProfile()
      return envFallback === 'orbit-default' ? 'planetz-orbit-default' : 'planetz-readonly'
    }
  }
}
