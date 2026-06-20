import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type ChatMcpServersOverviewResult,
  type ChatMcpSetSecretResult,
  isChatMcpEnabledForProvider,
  type McpPolicyFile,
  type McpPolicyServerEntry,
  type McpServerConfig,
  type McpServersFile,
  mcpPolicyFileSchema,
  mcpServersFileSchema,
  orbitRootPath,
} from '@planetz/shared'
import { parse as parseYaml } from 'yaml'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'
import { McpSecretStore, type McpSecretStoreDeps } from './mcp-secret-store.js'

const MCP_SERVERS_FILENAME = 'mcp-servers.yaml'
const MCP_POLICY_FILENAME = 'mcp-policy.yaml'
const MCP_CONSENT_KV_PREFIX = 'chat.mcp.consent.'
const SECRET_REF_PATTERN = /^\$SECRET:(.+)$/

type LoadedMcpWorkspace = {
  servers: McpServersFile
  policy: McpPolicyFile
}

type ResolvedSecretValue = {
  value: string
  secretRef: string | null
}

type ResolvedServerConfig = {
  config: McpServerConfig | null
  secretRefs: string[]
  unresolvedSecretRefs: string[]
}

type AgentResolution = {
  servers: McpServersFile
  allowedTools: string[]
  hasUnrestrictedServer: boolean
}

function parseSecretRef(value: string): string | null {
  const match = SECRET_REF_PATTERN.exec(value.trim())
  const secretName = match?.[1]?.trim()
  return secretName && secretName.length > 0 ? secretName : null
}

function mcpTransportFor(server: McpServerConfig): 'stdio' | 'sse' | 'http' {
  if (server.type === 'sse' || server.type === 'http') return server.type
  return 'stdio'
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readYamlFile(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf8')
  return parseYaml(raw)
}

function hasMcpConsent(
  db: Awaited<ReturnType<typeof getSidecarSqlite>>,
  serverId: string,
): boolean {
  const stored = readKvJson(db, `${MCP_CONSENT_KV_PREFIX}${serverId}`)
  return stored === true
}

export type McpConfigServiceDeps = {
  requireSidecarPaths: () => SidecarPaths
  requireWorkspacePath: () => string
  secretStore?: McpSecretStore
  secretStoreDeps?: Omit<McpSecretStoreDeps, 'requireSidecarPaths'>
}

export class McpConfigService {
  private readonly secretStore: McpSecretStore

  constructor(private readonly deps: McpConfigServiceDeps) {
    this.secretStore =
      deps.secretStore ??
      new McpSecretStore({
        requireSidecarPaths: deps.requireSidecarPaths,
        ...deps.secretStoreDeps,
      })
  }

  private async loadMcpWorkspace(): Promise<LoadedMcpWorkspace | null> {
    const workspacePath = this.deps.requireWorkspacePath()
    const orbitRoot = orbitRootPath(workspacePath)
    const serversPath = join(orbitRoot, MCP_SERVERS_FILENAME)
    const policyPath = join(orbitRoot, MCP_POLICY_FILENAME)
    if (!(await fileExists(serversPath))) return null

    const parsedServers = mcpServersFileSchema.safeParse(await readYamlFile(serversPath))
    if (!parsedServers.success) {
      throw new Error(`Invalid ${MCP_SERVERS_FILENAME}: ${parsedServers.error.message}`)
    }

    let policy = mcpPolicyFileSchema.parse({ servers: {} })
    if (await fileExists(policyPath)) {
      const parsedPolicy = mcpPolicyFileSchema.safeParse(await readYamlFile(policyPath))
      if (!parsedPolicy.success) {
        throw new Error(`Invalid ${MCP_POLICY_FILENAME}: ${parsedPolicy.error.message}`)
      }
      policy = parsedPolicy.data
    }

    return { servers: parsedServers.data, policy }
  }

  private async requireSidecarDb() {
    return getSidecarSqlite(this.deps.requireSidecarPaths())
  }

  private lookupEnvSecret(secretRef: string): string | null {
    const fromEnv = process.env[secretRef] ?? process.env[secretRef.toUpperCase()]
    return typeof fromEnv === 'string' && fromEnv.trim().length > 0 ? fromEnv.trim() : null
  }

  private async resolveSecretValue(raw: string): Promise<ResolvedSecretValue | null> {
    const trimmed = raw.trim()
    const secretRef = parseSecretRef(trimmed)
    if (!secretRef) return { value: trimmed, secretRef: null }
    const fromStore = await this.secretStore.getSecret(secretRef)
    if (fromStore) return { value: fromStore, secretRef }
    const fromEnv = this.lookupEnvSecret(secretRef)
    if (fromEnv) return { value: fromEnv, secretRef }
    return null
  }

  private async resolveRecord(record: Record<string, string> | undefined): Promise<{
    resolved: Record<string, string> | undefined
    refs: string[]
    unresolved: string[]
  }> {
    if (!record) return { resolved: undefined, refs: [], unresolved: [] }
    const resolved: Record<string, string> = {}
    const refs: string[] = []
    const unresolved: string[] = []
    for (const [key, raw] of Object.entries(record)) {
      const parsedRef = parseSecretRef(raw)
      if (parsedRef) refs.push(parsedRef)
      const resolvedValue = await this.resolveSecretValue(raw)
      if (!resolvedValue) {
        if (parsedRef) unresolved.push(parsedRef)
        continue
      }
      resolved[key] = resolvedValue.value
    }
    return { resolved, refs, unresolved }
  }

  private async resolveServerConfig(server: McpServerConfig): Promise<ResolvedServerConfig> {
    if (server.type === 'sse' || server.type === 'http') {
      const { resolved, refs, unresolved } = await this.resolveRecord(server.headers)
      if (unresolved.length > 0) {
        return {
          config: null,
          secretRefs: [...new Set(refs)],
          unresolvedSecretRefs: [...new Set(unresolved)],
        }
      }
      return {
        config: resolved ? { ...server, headers: resolved } : server,
        secretRefs: [...new Set(refs)],
        unresolvedSecretRefs: [],
      }
    }
    const { resolved, refs, unresolved } = await this.resolveRecord(server.env)
    if (unresolved.length > 0) {
      return {
        config: null,
        secretRefs: [...new Set(refs)],
        unresolvedSecretRefs: [...new Set(unresolved)],
      }
    }
    return {
      config: resolved ? { ...server, env: resolved } : server,
      secretRefs: [...new Set(refs)],
      unresolvedSecretRefs: [],
    }
  }

  private async resolveAgentConfig(providerId: string): Promise<AgentResolution | null> {
    if (!isChatMcpEnabledForProvider(providerId)) return null
    const loaded = await this.loadMcpWorkspace()
    if (!loaded) return null
    const db = await this.requireSidecarDb()
    const autoConsent = process.env.PLANETZ_MCP_AUTO_CONSENT === '1'
    const resolvedServers: McpServersFile = {}
    const allowedTools = new Set<string>()
    let hasUnrestrictedServer = false

    for (const [serverId, config] of Object.entries(loaded.servers)) {
      const policyEntry: McpPolicyServerEntry | undefined = loaded.policy.servers[serverId]
      if (policyEntry?.enabled === false) continue
      const needsConsent = policyEntry?.requireConsent !== false
      if (needsConsent && !autoConsent && !hasMcpConsent(db, serverId)) continue
      const resolved = await this.resolveServerConfig(config)
      if (!resolved.config) continue
      resolvedServers[serverId] = resolved.config
      const scopedAllowedTools = policyEntry?.allowedTools
      if (!scopedAllowedTools) {
        hasUnrestrictedServer = true
        continue
      }
      for (const tool of scopedAllowedTools) {
        allowedTools.add(tool)
      }
    }

    if (Object.keys(resolvedServers).length === 0) return null
    return { servers: resolvedServers, allowedTools: [...allowedTools], hasUnrestrictedServer }
  }

  async listPendingMcpConsentServers(): Promise<string[]> {
    const loaded = await this.loadMcpWorkspace()
    if (!loaded) return []
    if (process.env.PLANETZ_MCP_AUTO_CONSENT === '1') return []

    const db = await this.requireSidecarDb()
    const pending: string[] = []
    for (const serverId of Object.keys(loaded.servers)) {
      const entry = loaded.policy.servers[serverId]
      if (entry?.enabled === false) continue
      const needsConsent = entry?.requireConsent !== false
      if (!needsConsent) continue
      if (!hasMcpConsent(db, serverId)) pending.push(serverId)
    }
    return pending
  }

  async grantMcpConsent(serverId: string): Promise<void> {
    const trimmed = serverId.trim()
    if (!trimmed) throw new Error('MCP server id is required')
    const loaded = await this.loadMcpWorkspace()
    if (!loaded || !(trimmed in loaded.servers)) {
      throw new Error(`Unknown MCP server: ${trimmed}`)
    }
    const db = await this.requireSidecarDb()
    writeKvJson(db, `${MCP_CONSENT_KV_PREFIX}${trimmed}`, true)
  }

  async listMcpServersOverview(): Promise<ChatMcpServersOverviewResult> {
    const loaded = await this.loadMcpWorkspace()
    if (!loaded) {
      return {
        secureStoreAvailable: await this.secretStore.secureStoreAvailable(),
        servers: [],
      }
    }
    const db = await this.requireSidecarDb()
    const autoConsent = process.env.PLANETZ_MCP_AUTO_CONSENT === '1'
    const servers: ChatMcpServersOverviewResult['servers'] = []
    for (const [serverId, config] of Object.entries(loaded.servers)) {
      const entry = loaded.policy.servers[serverId]
      const enabled = entry?.enabled !== false
      const requiresConsent = entry?.requireConsent !== false
      const consentGranted =
        !enabled || !requiresConsent || autoConsent || hasMcpConsent(db, serverId)
      const resolved = await this.resolveServerConfig(config)
      servers.push({
        serverId,
        transport: mcpTransportFor(config),
        enabled,
        requiresConsent,
        consentGranted,
        allowedTools: [...(entry?.allowedTools ?? [])],
        secretRefs: [...resolved.secretRefs],
        unresolvedSecretRefs: [...resolved.unresolvedSecretRefs],
      })
    }
    return {
      secureStoreAvailable: await this.secretStore.secureStoreAvailable(),
      servers,
    }
  }

  async setMcpSecret(secretName: string, secretValue: string): Promise<ChatMcpSetSecretResult> {
    const storage = await this.secretStore.setSecret(secretName, secretValue)
    return { storage }
  }

  async resolveMcpServersForAgent(
    providerId: string,
  ): Promise<Record<string, McpServerConfig> | undefined> {
    const resolved = await this.resolveAgentConfig(providerId)
    return resolved?.servers
  }

  async resolveMcpAllowedToolsForAgent(providerId: string): Promise<string[] | undefined> {
    const resolved = await this.resolveAgentConfig(providerId)
    if (!resolved || resolved.allowedTools.length === 0 || resolved.hasUnrestrictedServer) {
      return undefined
    }
    return resolved.allowedTools
  }
}
