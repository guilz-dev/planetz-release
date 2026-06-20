import { access } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  planetzAgentOverridesRelPath,
  planetzEngineConfigRelPath,
  planetzWorkflowRelPath,
  type YamlOpenInput,
  type YamlOpenResult,
} from '@planetz/shared'
import { shell } from 'electron'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

/** Strip path segments; only a single workflow basename is allowed under `.planetz/orbit/workflows/`. */
export function sanitizePlanetWorkflowName(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const base = basename(trimmed).replace(/\.(yaml|yml)$/i, '')
  if (!base || base === '.' || base === '..') return null
  if (base.includes('/') || base.includes('\\')) return null
  return base
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function openPlanetzYaml(
  paths: SidecarPaths,
  input: YamlOpenInput,
): Promise<YamlOpenResult> {
  let absPath: string
  let relPath: string

  switch (input.target) {
    case 'engine-config':
      absPath = paths.engineConfigPath
      relPath = planetzEngineConfigRelPath()
      break
    case 'agent-overrides':
      absPath = paths.agentOverridesPath
      relPath = planetzAgentOverridesRelPath()
      break
    case 'workflow': {
      const name = input.workflowName ? sanitizePlanetWorkflowName(input.workflowName) : null
      if (!name) {
        return {
          status: 'denied',
          message: 'workflowName must be a single workflow basename',
        }
      }
      absPath = join(paths.planetzWorkflowsDir, `${name}.yaml`)
      relPath = planetzWorkflowRelPath(name)
      break
    }
    default:
      return { status: 'denied', message: 'Unknown yaml open target' }
  }

  if (!(await fileExists(absPath))) {
    return { status: 'not_found', path: relPath }
  }

  const openError = await shell.openPath(absPath)
  if (openError) {
    return { status: 'failed', path: relPath, message: openError }
  }
  return { status: 'opened', path: relPath }
}
