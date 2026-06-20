import { describe, expect, it } from 'vitest'
import { BRIDGE_INVOKE_MANIFEST } from '../bridge-manifest.js'
import { IPC_CHANNELS } from '../ipc-channels.js'
import {
  assertNoDuplicateChannelRegistrations,
  collectExportedSchemaNames,
  collectIpcRegistrations,
  readIpcSchemasSource,
  resolveRepoRoot,
} from './bridge-contract-test-helpers.js'

const REPO_ROOT = resolveRepoRoot(import.meta.url)

describe('ipc contract matrix', () => {
  it('keeps manifest invoke channels and IPC registrations in sync', () => {
    const registrationRows = collectIpcRegistrations(REPO_ROOT)
    assertNoDuplicateChannelRegistrations(registrationRows)
    const registrationKeys = new Set(registrationRows.map((row) => row.channelKey))
    const channelKeyByValue = new Map(
      Object.entries(IPC_CHANNELS).map(
        ([channelKey, channelValue]) => [channelValue, channelKey] as const,
      ),
    )
    const manifestKeys = new Set(
      BRIDGE_INVOKE_MANIFEST.map((entry) => channelKeyByValue.get(entry.channel)).filter(
        (key): key is string => typeof key === 'string',
      ),
    )
    expect(registrationKeys).toEqual(manifestKeys)
  })

  it('ensures schema-required handlers reference exported ipc-schemas', () => {
    const registrationRows = collectIpcRegistrations(REPO_ROOT)
    const schemaExports = collectExportedSchemaNames(readIpcSchemasSource(REPO_ROOT))
    for (const row of registrationRows) {
      if (row.requiresSchema) {
        expect(
          row.schemaName,
          `missing schema binding in ${row.sourceFile} (${row.channelKey})`,
        ).toBeTruthy()
      }
      if (!row.schemaName) continue
      expect(
        schemaExports.has(row.schemaName),
        `unknown schema "${row.schemaName}" in ${row.sourceFile} (${row.channelKey})`,
      ).toBe(true)
    }
  })

  it('classifies each invoke channel as mutation or readonly consistently', () => {
    const registrationRows = collectIpcRegistrations(REPO_ROOT)
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
      const registration = registrationByChannel.get(channelKey as string)
      expect(registration, `missing registration for ${channelKey}`).toBeDefined()
      const isMutation = registration?.registrationKind !== 'readonly'
      expect(
        isMutation,
        `${channelKey} should be ${entry.broadcasts ? 'mutation' : 'readonly'} but was ${registration?.registrationKind}`,
      ).toBe(entry.broadcasts)
    }
  })
})
