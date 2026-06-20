#!/usr/bin/env node
/**
 * Ensures BRIDGE_MANIFEST invoke methods match OrbitBridge interface keys (excluding onStateUpdate),
 * and manifest `broadcasts: true` flags match IPC handlers that broadcast state updates.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const bridgeTypesPath = join(root, 'packages/shared/src/bridge-types.ts')
const manifestPath = join(root, 'packages/shared/src/bridge-manifest.ts')

function extractOrbitBridgeMethods(source) {
  const start = source.indexOf('export interface OrbitBridge')
  if (start < 0) throw new Error('OrbitBridge interface not found')
  const braceStart = source.indexOf('{', start)
  let depth = 0
  let end = braceStart
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = source.slice(braceStart + 1, end)
  const methods = []
  for (const line of body.split('\n')) {
    const m = line.match(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\(/)
    if (m) methods.push(m[1])
  }
  return methods
}

function extractManifestInvokeMethods(source) {
  const start = source.indexOf('export const BRIDGE_INVOKE_MANIFEST = [')
  const end = source.indexOf('] as const', start)
  if (start < 0 || end < 0) throw new Error('BRIDGE_INVOKE_MANIFEST array not found')
  const arraySource = source.slice(start, end)
  const methods = []
  const blocks = arraySource.split(/\{\s*kind:\s*'invoke'/g)
  for (let i = 1; i < blocks.length; i++) {
    const m = blocks[i].match(/method:\s*'([^']+)'/)
    if (m) methods.push(m[1])
  }
  return methods
}

function extractManifestBroadcastChannels(source) {
  const start = source.indexOf('export const BRIDGE_INVOKE_MANIFEST = [')
  const end = source.indexOf('] as const', start)
  if (start < 0 || end < 0) throw new Error('BRIDGE_INVOKE_MANIFEST array not found')
  const arraySource = source.slice(start, end)
  const channels = []
  const blocks = arraySource.split(/\{\s*kind:\s*'invoke'/g)
  for (let i = 1; i < blocks.length; i++) {
    const channelMatch = blocks[i].match(/channel:\s*IPC_CHANNELS\.(\w+)/)
    const broadcastsMatch = blocks[i].match(/broadcasts:\s*(true|false)/)
    if (!channelMatch || !broadcastsMatch) continue
    if (broadcastsMatch[1] === 'true') channels.push(channelMatch[1])
  }
  return channels
}

function extractIpcBroadcastChannels(ipcDir) {
  const channels = new Set()
  for (const name of readdirSync(ipcDir)) {
    if (!name.startsWith('register-') || name === 'register-ipc.ts') continue
    const text = readFileSync(join(ipcDir, name), 'utf8')
    for (const m of text.matchAll(
      /registerMutationHandler(?:NoInput)?\([\s\S]*?IPC_CHANNELS\.(\w+)/g,
    )) {
      channels.add(m[1])
    }
    for (const m of text.matchAll(/registerHandler\([\s\S]*?IPC_CHANNELS\.(\w+)/g)) {
      const ch = m[1]
      const start = m.index
      const rest = text.slice(m.index + m[0].length)
      const next = rest.match(/register(Handler|MutationHandler)/)
      const end = m.index + m[0].length + (next ? next.index : rest.length)
      const block = text.slice(start, end)
      if (block.includes('broadcastMutation')) channels.add(ch)
    }
  }
  return [...channels]
}

const bridgeTypes = readFileSync(bridgeTypesPath, 'utf8')
const manifest = readFileSync(manifestPath, 'utf8')

function extractBridgeEventMethods(manifestSource) {
  const start = manifestSource.indexOf('export const BRIDGE_EVENT_ENTRIES = [')
  const end = manifestSource.indexOf('] as const', start)
  if (start < 0 || end < 0) throw new Error('BRIDGE_EVENT_ENTRIES array not found')
  const block = manifestSource.slice(start, end)
  const methods = []
  for (const match of block.matchAll(/method:\s*'([^']+)'/g)) {
    methods.push(match[1])
  }
  return methods
}

const bridgeEventMethods = extractBridgeEventMethods(manifest)
const orbitMethods = extractOrbitBridgeMethods(bridgeTypes).filter(
  (n) => !bridgeEventMethods.includes(n),
)
const manifestMethods = extractManifestInvokeMethods(manifest)

const orbitSet = new Set(orbitMethods)
const manifestSet = new Set(manifestMethods)

const missingInManifest = orbitMethods.filter((m) => !manifestSet.has(m))
const extraInManifest = manifestMethods.filter((m) => !orbitSet.has(m))

if (missingInManifest.length > 0 || extraInManifest.length > 0) {
  console.error('Bridge manifest sync failed:')
  if (missingInManifest.length > 0) {
    console.error('  Missing in bridge-manifest.ts:', missingInManifest.join(', '))
  }
  if (extraInManifest.length > 0) {
    console.error('  Extra in bridge-manifest.ts:', extraInManifest.join(', '))
  }
  process.exit(1)
}

const ipcDir = join(root, 'apps/desktop/src/main/ipc')
const manifestBroadcastChannels = extractManifestBroadcastChannels(manifest)
const ipcBroadcastChannels = extractIpcBroadcastChannels(ipcDir)

const manifestBroadcastSet = new Set(manifestBroadcastChannels)
const ipcBroadcastSet = new Set(ipcBroadcastChannels)

const broadcastMissingInManifest = ipcBroadcastChannels.filter((c) => !manifestBroadcastSet.has(c))
const broadcastExtraInManifest = manifestBroadcastChannels.filter((c) => !ipcBroadcastSet.has(c))

if (broadcastMissingInManifest.length > 0 || broadcastExtraInManifest.length > 0) {
  console.error('Bridge manifest broadcast flags out of sync with IPC:')
  if (broadcastMissingInManifest.length > 0) {
    console.error(
      '  IPC broadcasts but manifest broadcasts:false:',
      broadcastMissingInManifest.join(', '),
    )
  }
  if (broadcastExtraInManifest.length > 0) {
    console.error(
      '  manifest broadcasts:true but IPC has no broadcast:',
      broadcastExtraInManifest.join(', '),
    )
  }
  process.exit(1)
}

console.log(
  `Bridge sync OK (${orbitMethods.length} invoke methods, ${ipcBroadcastChannels.length} state broadcasts)`,
)
