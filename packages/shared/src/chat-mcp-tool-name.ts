export type ParsedChatMcpToolName = {
  serverId: string
  toolName: string
}

export type ParseChatMcpToolNameOptions = {
  knownServerIds?: ReadonlySet<string>
}

function nonEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Best-effort parser for MCP tool identifiers emitted by providers.
 * Supports:
 * - mcp__<server>__<tool>
 * - mcp.<server>.<tool>
 * - <server>/<tool> (only when `<server>` is in `knownServerIds`)
 * - <server>:<tool> (only when `<server>` is in `knownServerIds`)
 */
export function parseChatMcpToolName(
  rawToolName: string,
  options?: ParseChatMcpToolNameOptions,
): ParsedChatMcpToolName | null {
  const raw = rawToolName.trim()
  if (!raw) return null

  const doubleUnderscore = /^mcp__([^_].+?)__(.+)$/.exec(raw)
  if (doubleUnderscore) {
    const serverId = nonEmpty(doubleUnderscore[1] ?? '')
    const toolName = nonEmpty(doubleUnderscore[2] ?? '')
    if (serverId && toolName) return { serverId, toolName }
  }

  const dotStyle = /^mcp\.([^.]+)\.(.+)$/.exec(raw)
  if (dotStyle) {
    const serverId = nonEmpty(dotStyle[1] ?? '')
    const toolName = nonEmpty(dotStyle[2] ?? '')
    if (serverId && toolName) return { serverId, toolName }
  }

  const knownServerIds = options?.knownServerIds
  if (knownServerIds && knownServerIds.size > 0) {
    const slashIndex = raw.indexOf('/')
    if (slashIndex > 0 && slashIndex < raw.length - 1) {
      const serverId = nonEmpty(raw.slice(0, slashIndex))
      const toolName = nonEmpty(raw.slice(slashIndex + 1))
      if (serverId && toolName && knownServerIds.has(serverId)) {
        return { serverId, toolName }
      }
    }

    const colonIndex = raw.indexOf(':')
    if (colonIndex > 0 && colonIndex < raw.length - 1) {
      const serverId = nonEmpty(raw.slice(0, colonIndex))
      const toolName = nonEmpty(raw.slice(colonIndex + 1))
      if (serverId && toolName && knownServerIds.has(serverId)) {
        return { serverId, toolName }
      }
    }
  }

  return null
}
