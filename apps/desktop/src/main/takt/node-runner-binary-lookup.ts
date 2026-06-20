import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'

export function isElectronBinary(binaryPath: string): boolean {
  return basename(binaryPath).toLowerCase().includes('electron')
}

function isUsableNodeRunnerBinary(binaryPath: string): boolean {
  const trimmed = binaryPath.trim()
  return trimmed.length > 0 && existsSync(trimmed) && !isElectronBinary(trimmed)
}

/** Resolves `node` on PATH; returns null when unavailable or path is Electron. */
export function lookupNodeBinaryOnPath(): string | null {
  try {
    const isWindows = process.platform === 'win32'
    const command = isWindows ? 'where.exe' : 'which'
    const resolved = execFileSync(command, ['node'], { encoding: 'utf8' }).trim()
    const candidate = isWindows ? (resolved.split(/\r?\n/)[0]?.trim() ?? '') : resolved
    if (isUsableNodeRunnerBinary(candidate)) return candidate
  } catch {
    // lookup command unavailable or node not on PATH
  }
  return null
}

export function isUsableNodeRunnerPath(binaryPath: string): boolean {
  return isUsableNodeRunnerBinary(binaryPath)
}
