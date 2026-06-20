import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  type AgentOverrides,
  DEFAULT_AGENT_OVERRIDES,
  parseAgentOverridesYaml,
} from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

export class AgentOverridesStore {
  async exists(paths: SidecarPaths): Promise<boolean> {
    try {
      await readFile(paths.agentOverridesPath, 'utf8')
      return true
    } catch {
      return false
    }
  }

  async load(paths: SidecarPaths): Promise<AgentOverrides> {
    let raw: string
    try {
      raw = await readFile(paths.agentOverridesPath, 'utf8')
    } catch {
      return { ...DEFAULT_AGENT_OVERRIDES }
    }
    const doc = parseYaml(raw)
    return parseAgentOverridesYaml(doc)
  }

  async save(paths: SidecarPaths, overrides: AgentOverrides): Promise<AgentOverrides> {
    const parsed = parseAgentOverridesYaml(overrides)
    await mkdir(dirname(paths.agentOverridesPath), { recursive: true })
    await writeFile(paths.agentOverridesPath, stringifyYaml(parsed, { lineWidth: 0 }), 'utf8')
    return parsed
  }
}
