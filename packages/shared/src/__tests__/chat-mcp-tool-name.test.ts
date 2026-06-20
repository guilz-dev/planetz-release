import { describe, expect, it } from 'vitest'
import { parseChatMcpToolName } from '../chat-mcp-tool-name.js'

describe('parseChatMcpToolName', () => {
  it('parses mcp__server__tool format', () => {
    expect(parseChatMcpToolName('mcp__github__search_issues')).toEqual({
      serverId: 'github',
      toolName: 'search_issues',
    })
  })

  it('parses mcp.server.tool format', () => {
    expect(parseChatMcpToolName('mcp.github.get_issue')).toEqual({
      serverId: 'github',
      toolName: 'get_issue',
    })
  })

  it('parses slash format', () => {
    expect(
      parseChatMcpToolName('github/search_issues', {
        knownServerIds: new Set(['github']),
      }),
    ).toEqual({
      serverId: 'github',
      toolName: 'search_issues',
    })
  })

  it('does not parse slash format without known server list', () => {
    expect(parseChatMcpToolName('github/search_issues')).toBeNull()
  })

  it('returns null for non-mcp names', () => {
    expect(parseChatMcpToolName('Read')).toBeNull()
  })
})
