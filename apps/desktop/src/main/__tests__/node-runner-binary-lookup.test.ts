import { describe, expect, it } from 'vitest'
import { isElectronBinary, isUsableNodeRunnerPath } from '../takt/node-runner-binary-lookup.js'

describe('node-runner-binary-lookup', () => {
  it('detects Electron binaries by basename', () => {
    expect(isElectronBinary('/Applications/Foo.app/Contents/MacOS/Electron')).toBe(true)
    expect(isElectronBinary(process.execPath)).toBe(false)
  })

  it('rejects Electron paths for runner use', () => {
    expect(isUsableNodeRunnerPath('/Applications/Planetz.app/Contents/MacOS/Electron')).toBe(false)
    expect(isUsableNodeRunnerPath(process.execPath)).toBe(true)
  })
})
