import { createRequire } from 'node:module'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'
import { getSidecarSqlite } from '../storage/sqlite/connection.js'
import { readKvJson, writeKvJson } from '../storage/sqlite/kv-store.js'

export type McpSecretStorage = 'secure' | 'fallback'

const SECRET_NAME_PATTERN = /^[A-Za-z0-9._-]+$/
const MCP_SECRET_KV_PREFIX = 'chat.mcp.secret.'

type McpSecretRecord = {
  storage: McpSecretStorage
  payload: string
}

type SafeStoragePort = {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(cipher: Buffer): string
}

function normalizeSecretName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || !SECRET_NAME_PATTERN.test(trimmed)) {
    throw new Error('Invalid MCP secret name')
  }
  return trimmed
}

function resolveSafeStoragePort(): SafeStoragePort | null {
  try {
    const require = createRequire(import.meta.url)
    const electron = require('electron') as { safeStorage?: SafeStoragePort }
    return electron.safeStorage ?? null
  } catch {
    return null
  }
}

export type McpSecretStoreDeps = {
  requireSidecarPaths: () => SidecarPaths
  safeStoragePort?: SafeStoragePort | null
}

export class McpSecretStore {
  private readonly safeStoragePort: SafeStoragePort | null

  constructor(private readonly deps: McpSecretStoreDeps) {
    this.safeStoragePort = deps.safeStoragePort ?? resolveSafeStoragePort()
  }

  private async db() {
    return getSidecarSqlite(this.deps.requireSidecarPaths())
  }

  private isSafeStorageAvailable(): boolean {
    if (!this.safeStoragePort) return false
    try {
      return this.safeStoragePort.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  async secureStoreAvailable(): Promise<boolean> {
    return this.isSafeStorageAvailable()
  }

  async setSecret(secretName: string, secretValue: string): Promise<McpSecretStorage> {
    const normalizedName = normalizeSecretName(secretName)
    const normalizedValue = secretValue.trim()
    if (!normalizedValue) throw new Error('MCP secret value is required')
    const db = await this.db()
    if (this.isSafeStorageAvailable() && this.safeStoragePort) {
      const payload = this.safeStoragePort.encryptString(normalizedValue).toString('base64')
      writeKvJson(db, `${MCP_SECRET_KV_PREFIX}${normalizedName}`, {
        storage: 'secure',
        payload,
      } satisfies McpSecretRecord)
      return 'secure'
    }
    writeKvJson(db, `${MCP_SECRET_KV_PREFIX}${normalizedName}`, {
      storage: 'fallback',
      payload: normalizedValue,
    } satisfies McpSecretRecord)
    return 'fallback'
  }

  async getSecret(secretName: string): Promise<string | undefined> {
    const normalizedName = normalizeSecretName(secretName)
    const db = await this.db()
    const stored = readKvJson(db, `${MCP_SECRET_KV_PREFIX}${normalizedName}`)
    if (!stored || typeof stored !== 'object') return undefined
    const record = stored as Partial<McpSecretRecord>
    if (record.storage === 'fallback') {
      return typeof record.payload === 'string' && record.payload.trim().length > 0
        ? record.payload.trim()
        : undefined
    }
    if (record.storage !== 'secure' || typeof record.payload !== 'string') return undefined
    if (!this.safeStoragePort || !this.isSafeStorageAvailable()) return undefined
    try {
      const decrypted = this.safeStoragePort.decryptString(Buffer.from(record.payload, 'base64'))
      return decrypted.trim().length > 0 ? decrypted.trim() : undefined
    } catch {
      return undefined
    }
  }
}
