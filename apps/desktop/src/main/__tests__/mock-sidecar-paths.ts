import { join } from 'node:path'
import {
  CHAINS_FILENAME,
  CONVERSATIONS_FILENAME,
  EFFORT_HISTORY_FILENAME,
  MOCK_QUEUE_FILENAME,
  MODEL_HISTORY_FILENAME,
  PLANETZ_AGENT_OVERRIDES_FILENAME,
  PLANETZ_AGENTS_DIRNAME,
  PLANETZ_ENGINE_CONFIG_FILENAME,
  PLANETZ_SQLITE_FILENAME,
  PLANETZ_WORKFLOWS_DIRNAME,
  RETRY_CONTEXTS_FILENAME,
  WATCH_STATE_FILENAME,
} from '@planetz/shared'
import type { SidecarPaths } from '../sidecar/sidecar-paths.js'

/** Build a full {@link SidecarPaths} fixture for tests under a sidecar root. */
export function mockSidecarPaths(root: string, isWorkspaceLocal = true): SidecarPaths {
  return {
    root,
    configPath: join(root, 'config.json'),
    engineConfigPath: join(root, PLANETZ_ENGINE_CONFIG_FILENAME),
    agentOverridesPath: join(root, PLANETZ_AGENTS_DIRNAME, PLANETZ_AGENT_OVERRIDES_FILENAME),
    planetzWorkflowsDir: join(root, PLANETZ_WORKFLOWS_DIRNAME),
    sqlitePath: join(root, PLANETZ_SQLITE_FILENAME),
    uiStatePath: join(root, 'ui-state.json'),
    promptHistoryPath: join(root, 'prompt-history.json'),
    modelHistoryPath: join(root, MODEL_HISTORY_FILENAME),
    effortHistoryPath: join(root, EFFORT_HISTORY_FILENAME),
    mockQueuePath: join(root, MOCK_QUEUE_FILENAME),
    conversationsPath: join(root, CONVERSATIONS_FILENAME),
    retryContextsPath: join(root, RETRY_CONTEXTS_FILENAME),
    chainsPath: join(root, CHAINS_FILENAME),
    watchStatePath: join(root, WATCH_STATE_FILENAME),
    isWorkspaceLocal,
  }
}
