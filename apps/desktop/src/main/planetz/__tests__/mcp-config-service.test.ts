import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isChatMcpEnabledForProvider, resolveChatMcpEnabledByProvider } from '@planetz/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { McpConfigService } from '../mcp-config-service.js'

describe('McpConfigService', () => {
  let workspacePath = ''

  beforeEach(async () => {
    workspacePath = join(tmpdir(), `mcp-config-${Date.now()}`)
    await mkdir(join(workspacePath, '.planetz', 'orbit'), { recursive: true })
  })

  afterEach(() => {
    delete process.env.PLANETZ_MCP_AUTO_CONSENT
    delete process.env.GITHUB_TOKEN
  })

  it('returns undefined when mcp-servers.yaml is missing', async () => {
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
    })
    await expect(service.resolveMcpServersForAgent('claude-sdk')).resolves.toBeUndefined()
  })

  it('loads stdio servers when auto consent is enabled', async () => {
    process.env.PLANETZ_MCP_AUTO_CONSENT = '1'
    process.env.GITHUB_TOKEN = 'token-value'
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `github:
  command: npx
  args: ['-y', '@modelcontextprotocol/server-github']
  env:
    GITHUB_TOKEN: '$SECRET:GITHUB_TOKEN'
`,
      'utf8',
    )
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-policy.yaml'),
      `servers:
  github:
    enabled: true
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
    })
    const resolved = await service.resolveMcpServersForAgent('claude-sdk')
    expect(resolved?.github).toMatchObject({
      command: 'npx',
      env: { GITHUB_TOKEN: 'token-value' },
    })
  })

  it('skips servers when $SECRET env vars are unresolved', async () => {
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `secret-srv:
  command: echo
  args: ['mcp']
  env:
    TOKEN: '$SECRET:PLANETZ_TEST_MISSING_SECRET'
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
    })
    await expect(service.resolveMcpServersForAgent('claude-sdk')).resolves.toBeUndefined()
  })

  it('lists servers pending consent until granted', async () => {
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `github:
  command: echo
  args: ['mcp']
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
    })
    await expect(service.listPendingMcpConsentServers()).resolves.toEqual(['github'])
    await service.grantMcpConsent('github')
    await expect(service.listPendingMcpConsentServers()).resolves.toEqual([])
    const resolved = await service.resolveMcpServersForAgent('claude-sdk')
    expect(resolved?.github).toMatchObject({ command: 'echo' })
  })

  it('returns undefined allowed tools when any server has no allowlist', async () => {
    process.env.PLANETZ_MCP_AUTO_CONSENT = '1'
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `github:
  command: echo
  args: ['mcp']
other:
  command: echo
  args: ['mcp2']
`,
      'utf8',
    )
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-policy.yaml'),
      `servers:
  github:
    allowedTools:
      - search_issues
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
    })
    await expect(service.resolveMcpAllowedToolsForAgent('claude-sdk')).resolves.toBeUndefined()
  })

  it('returns allowed tools from policy for resolved servers', async () => {
    process.env.PLANETZ_MCP_AUTO_CONSENT = '1'
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `github:
  command: echo
  args: ['mcp']
`,
      'utf8',
    )
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-policy.yaml'),
      `servers:
  github:
    allowedTools:
      - search_issues
      - get_issue
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
    })
    await expect(service.resolveMcpAllowedToolsForAgent('claude-sdk')).resolves.toEqual([
      'search_issues',
      'get_issue',
    ])
  })

  it('stores secret and resolves $SECRET refs without env vars', async () => {
    process.env.PLANETZ_MCP_AUTO_CONSENT = '1'
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `github:
  command: echo
  env:
    TOKEN: '$SECRET:GITHUB_TOKEN'
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
      secretStoreDeps: {
        safeStoragePort: null,
      },
    })
    await expect(service.setMcpSecret('GITHUB_TOKEN', 'token-from-store')).resolves.toEqual({
      storage: 'fallback',
    })
    const resolved = await service.resolveMcpServersForAgent('claude-sdk')
    expect(resolved?.github).toMatchObject({
      env: { TOKEN: 'token-from-store' },
    })
  })

  it('lists MCP overview with unresolved secrets', async () => {
    await writeFile(
      join(workspacePath, '.planetz', 'orbit', 'mcp-servers.yaml'),
      `github:
  command: echo
  env:
    TOKEN: '$SECRET:GITHUB_TOKEN'
`,
      'utf8',
    )
    const service = new McpConfigService({
      requireWorkspacePath: () => workspacePath,
      requireSidecarPaths: () =>
        ({
          sidecarDir: join(workspacePath, '.planetz', 'orbit'),
          sqlitePath: join(workspacePath, '.planetz', 'orbit', 'planetz.db'),
        }) as never,
      secretStoreDeps: {
        safeStoragePort: null,
      },
    })
    const overview = await service.listMcpServersOverview()
    expect(overview.servers).toHaveLength(1)
    expect(overview.servers[0]).toMatchObject({
      serverId: 'github',
      secretRefs: ['GITHUB_TOKEN'],
      unresolvedSecretRefs: ['GITHUB_TOKEN'],
    })
  })
})

describe('chat MCP capability flags', () => {
  it('enables MCP only for claude providers', () => {
    expect(isChatMcpEnabledForProvider('claude-sdk')).toBe(true)
    expect(isChatMcpEnabledForProvider('ollama')).toBe(false)
    expect(resolveChatMcpEnabledByProvider()).toMatchObject({
      'claude-sdk': true,
      ollama: false,
    })
  })
})
