import { type OrbitInteractiveStreamLine, parseChatMcpToolName } from '@planetz/shared'

/** In-flight assistant row shown while composerSession:message is streaming. */
export type ChatStreamingTurn = {
  id: string
  role: 'assistant'
  text: string
  activities: ChatStreamActivity[]
}

export type ChatStreamActivity =
  | { kind: 'thinking'; text: string }
  | { kind: 'tool_use'; tool: string; id: string; mcpServerId?: string; mcpToolName?: string }
  | { kind: 'tool_output'; tool: string; output: string }
  | { kind: 'tool_result'; content: string; isError: boolean }
  | { kind: 'rate_limit'; status: string }
  | { kind: 'error'; message: string }

export function applyComposerStreamLine(
  current: ChatStreamingTurn,
  line: OrbitInteractiveStreamLine,
): ChatStreamingTurn {
  if (line.done) {
    return current
  }
  const event = line.event
  if (!event) return current

  switch (event.type) {
    case 'text': {
      const text = typeof event.data.text === 'string' ? event.data.text : ''
      if (!text) return current
      return { ...current, text: current.text + text }
    }
    case 'thinking': {
      const thinking = typeof event.data.thinking === 'string' ? event.data.thinking : ''
      if (!thinking) return current
      const last = current.activities.at(-1)
      if (last?.kind === 'thinking') {
        return {
          ...current,
          activities: [
            ...current.activities.slice(0, -1),
            { kind: 'thinking', text: last.text + thinking },
          ],
        }
      }
      return {
        ...current,
        activities: [...current.activities, { kind: 'thinking', text: thinking }],
      }
    }
    case 'tool_use': {
      const tool = typeof event.data.tool === 'string' ? event.data.tool : 'tool'
      const id =
        typeof event.data.id === 'string' ? event.data.id : String(current.activities.length)
      const parsedMcp = parseChatMcpToolName(tool)
      const existingIndex = current.activities.findIndex(
        (activity) => activity.kind === 'tool_use' && activity.id === id,
      )
      if (existingIndex >= 0) return current
      return {
        ...current,
        activities: [
          ...current.activities,
          {
            kind: 'tool_use',
            tool,
            id,
            ...(parsedMcp
              ? { mcpServerId: parsedMcp.serverId, mcpToolName: parsedMcp.toolName }
              : {}),
          },
        ],
      }
    }
    case 'tool_output': {
      const tool = typeof event.data.tool === 'string' ? event.data.tool : 'tool'
      const output = typeof event.data.output === 'string' ? event.data.output : ''
      return {
        ...current,
        activities: [...current.activities, { kind: 'tool_output', tool, output }],
      }
    }
    case 'tool_result': {
      const content = typeof event.data.content === 'string' ? event.data.content : ''
      const isError = Boolean(event.data.isError)
      return {
        ...current,
        activities: [...current.activities, { kind: 'tool_result', content, isError }],
      }
    }
    case 'rate_limit': {
      const status = typeof event.data.status === 'string' ? event.data.status : 'unknown'
      return {
        ...current,
        activities: [...current.activities, { kind: 'rate_limit', status }],
      }
    }
    case 'error':
    case 'assistant_error': {
      const message =
        typeof event.data.message === 'string'
          ? event.data.message
          : typeof event.data.error === 'string'
            ? event.data.error
            : 'Stream error'
      return {
        ...current,
        activities: [...current.activities, { kind: 'error', message }],
      }
    }
    // `init` / `result` are forwarded on stderr for tooling; canonical UI uses getThread after invoke completes.
    default:
      return current
  }
}

/** Stable list keys for stream activity rows (thinking is a single merged row). */
export function streamActivityKey(activity: ChatStreamActivity, index: number): string {
  switch (activity.kind) {
    case 'tool_use':
      return `tool_use:${activity.id}`
    case 'thinking':
      return 'thinking'
    case 'tool_output':
      return `tool_output:${activity.tool}:${index}`
    case 'tool_result':
      return `tool_result:${index}`
    case 'rate_limit':
      return `rate_limit:${activity.status}:${index}`
    case 'error':
      return `error:${index}`
    default:
      return `activity:${index}`
  }
}
