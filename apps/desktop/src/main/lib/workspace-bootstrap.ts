import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isEngineExecutionDefaultsConfigured,
  orbitRootPath,
  PLANETZ_ENGINE_CONFIG_FILENAME,
  parseEngineConfigYaml,
  type WorkspaceBootstrapStatus,
} from '@planetz/shared'
import { parse as parseYaml } from 'yaml'

/**
 * Bootstrap is Planetz-side readiness, not isolated `.takt` readiness:
 * - non_takt: sidecar root missing
 * - partial_takt: sidecar exists but provider/model defaults are not configured
 * - takt_ready: sidecar + provider/model defaults are configured
 */
export function classifyWorkspaceBootstrap(
  workspacePath: string,
  sidecarRootPath?: string,
): WorkspaceBootstrapStatus {
  const sidecarRoot = sidecarRootPath ?? orbitRootPath(workspacePath)
  if (!existsSync(sidecarRoot)) return 'non_takt'

  const engineConfigPath = join(sidecarRoot, PLANETZ_ENGINE_CONFIG_FILENAME)
  if (!existsSync(engineConfigPath)) return 'partial_takt'

  try {
    const raw = readFileSync(engineConfigPath, 'utf8')
    const parsed = parseEngineConfigYaml(parseYaml(raw))
    return isEngineExecutionDefaultsConfigured(parsed) ? 'takt_ready' : 'partial_takt'
  } catch {
    return 'partial_takt'
  }
}
