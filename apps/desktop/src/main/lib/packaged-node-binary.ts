import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

const PACKAGED_NODE_RELATIVE_SEGMENTS = ['node', 'bin', 'node'] as const

export function resolvePackagedNodeBinaryPath(resourcesPath: string): string {
  return join(resourcesPath, ...PACKAGED_NODE_RELATIVE_SEGMENTS)
}

export interface PackagedNodeBinaryEnvOptions {
  isPackaged?: boolean
  resourcesPath?: string
  env?: NodeJS.ProcessEnv
}

/** Points PLANETZ_NODE_BINARY at the bundled Node when running a packaged macOS build. */
export function applyPackagedNodeBinaryEnv(options: PackagedNodeBinaryEnvOptions = {}): void {
  const isPackaged = options.isPackaged ?? app.isPackaged
  if (!isPackaged) return

  const env = options.env ?? process.env
  if (env.PLANETZ_NODE_BINARY?.trim()) return

  const resourcesPath = options.resourcesPath ?? process.resourcesPath?.trim()
  if (!resourcesPath) return

  const candidate = resolvePackagedNodeBinaryPath(resourcesPath)
  if (!existsSync(candidate)) return

  env.PLANETZ_NODE_BINARY = candidate
}
