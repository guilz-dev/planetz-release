import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  applyEngineConfigRuntimeDefaults,
  DEFAULT_ENGINE_CONFIG,
  type EngineConfig,
  parseEngineConfigYaml,
} from '@planetz/shared'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

export class EngineConfigStore {
  async exists(paths: SidecarPaths): Promise<boolean> {
    try {
      await readFile(paths.engineConfigPath, 'utf8')
      return true
    } catch {
      return false
    }
  }

  async load(paths: SidecarPaths): Promise<EngineConfig> {
    let raw: string
    try {
      raw = await readFile(paths.engineConfigPath, 'utf8')
    } catch {
      return applyEngineConfigRuntimeDefaults({ ...DEFAULT_ENGINE_CONFIG })
    }
    const doc = parseYaml(raw)
    return applyEngineConfigRuntimeDefaults(parseEngineConfigYaml(doc))
  }

  async save(paths: SidecarPaths, config: EngineConfig): Promise<EngineConfig> {
    const parsed = applyEngineConfigRuntimeDefaults(parseEngineConfigYaml(config))
    await mkdir(dirname(paths.engineConfigPath), { recursive: true })
    await writeFile(paths.engineConfigPath, stringifyYaml(parsed, { lineWidth: 0 }), 'utf8')
    return parsed
  }
}
