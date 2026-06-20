import { describe, expect, it } from 'vitest'
import { BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { IPC_CHANNELS } from '../ipc-channels.js'
import {
  assertNoDuplicateChannelRegistrations,
  collectIpcRegistrations,
  extractOrbitBridgeInvokeMethods,
  readBridgeTypesSource,
  resolveRepoRoot,
} from './bridge-contract-test-helpers.js'

const REPO_ROOT = resolveRepoRoot(import.meta.url)

describe('bridge contract sync', () => {
  it('keeps OrbitBridge invoke methods and bridge-manifest methods in sync', () => {
    const bridgeTypesSource = readBridgeTypesSource(REPO_ROOT)
    const orbitMethods = extractOrbitBridgeInvokeMethods(bridgeTypesSource).filter(
      (method) =>
        method !== 'onStateUpdate' &&
        method !== 'onComposerSessionStream' &&
        method !== 'onUiFocusTask',
    )
    const manifestMethods = BRIDGE_INVOKE_MANIFEST.map((entry) => entry.method)
    expect(new Set(orbitMethods)).toEqual(new Set(manifestMethods))
  })

  it('keeps manifest broadcast flags and IPC mutation registration kind in sync', () => {
    const registrationRows = collectIpcRegistrations(REPO_ROOT)
    assertNoDuplicateChannelRegistrations(registrationRows)
    const registrationByChannel = new Map(
      registrationRows.map((row) => [row.channelKey, row] as const),
    )
    const channelKeyByValue = new Map(
      Object.entries(IPC_CHANNELS).map(
        ([channelKey, channelValue]) => [channelValue, channelKey] as const,
      ),
    )
    for (const entry of BRIDGE_INVOKE_MANIFEST) {
      const channelKey = channelKeyByValue.get(entry.channel)
      expect(channelKey, `unknown IPC channel in manifest: ${entry.channel}`).toBeDefined()
      const row = registrationByChannel.get(channelKey as string)
      expect(row, `missing IPC registration for ${channelKey}`).toBeDefined()
      const isMutation = row?.registrationKind !== 'readonly'
      expect(
        isMutation,
        `broadcast mismatch for ${channelKey}: manifest.broadcasts=${entry.broadcasts} registration=${row?.registrationKind}`,
      ).toBe(entry.broadcasts)
    }
    const manifestBroadcastKeys = new Set(
      BRIDGE_INVOKE_MANIFEST.filter((entry) => entry.broadcasts)
        .map((entry) => channelKeyByValue.get(entry.channel))
        .filter((key): key is string => typeof key === 'string'),
    )
    const ipcBroadcastKeys = new Set(
      registrationRows
        .filter((row) => row.registrationKind !== 'readonly')
        .map((row) => row.channelKey),
    )
    expect(ipcBroadcastKeys).toEqual(manifestBroadcastKeys)
  })
})
