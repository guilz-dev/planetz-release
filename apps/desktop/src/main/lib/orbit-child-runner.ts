import { headlessInteractiveUnavailableMessage } from '@planetz/shared'
import { NodeRunnerBinaryNotFoundError, resolveTaktCliRunnerBinary } from '../takt/exec-cli.js'
import { isElectronBinary } from '../takt/node-runner-binary-lookup.js'
import { logRunnerSpawnTrace } from './runner-spawn-trace.js'

/** Resolves the Node binary for orbit headless runners with a user-facing error when missing. */
export function resolveOrbitChildRunnerBinary(): string {
  try {
    return resolveTaktCliRunnerBinary()
  } catch (error) {
    if (error instanceof NodeRunnerBinaryNotFoundError) {
      throw new Error(headlessInteractiveUnavailableMessage(error.message))
    }
    throw error
  }
}

/** Builds child-process env for orbit runners; sets ELECTRON_RUN_AS_NODE only when required. */
export function buildOrbitChildRunnerEnv(
  runnerBinary: string,
  extras: Record<string, string | undefined>,
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries({ ...process.env, ...extras })) {
    if (value !== undefined) env[key] = value
  }
  if (isElectronBinary(runnerBinary)) {
    env.ELECTRON_RUN_AS_NODE = '1'
  } else {
    delete env.ELECTRON_RUN_AS_NODE
  }
  return env
}

export function traceOrbitChildRunnerSpawn(
  channel: string,
  details: Record<string, string | number | undefined>,
  subprocess: { pid?: number },
): void {
  logRunnerSpawnTrace(channel, { ...details, pid: subprocess.pid })
}
