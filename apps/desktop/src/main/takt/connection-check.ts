import {
  BUNDLED_ORBIT_NOT_FOUND_MESSAGE,
  type ConnectionState,
  ORBIT_DISPLAY_NAME,
  type UiConfig,
} from '@planetz/shared'
import { BundledOrbitNotFoundError, outputText, runTaktCli } from './exec-cli.js'

export async function checkTaktCli(config: UiConfig): Promise<ConnectionState> {
  const checkedAt = new Date().toISOString()
  try {
    const result = await runTaktCli(config, ['--help'], {
      timeout: 10_000,
      reject: false,
    })
    if (result.exitCode === 0) {
      return { cli: 'ok', watch: 'unknown', checkedAt }
    }
    return {
      cli: 'ng',
      watch: 'unknown',
      lastError: summarizeCliFailure(result),
      checkedAt,
    }
  } catch (error) {
    if (error instanceof BundledOrbitNotFoundError) {
      return {
        cli: 'ng',
        watch: 'unknown',
        lastError: BUNDLED_ORBIT_NOT_FOUND_MESSAGE,
        checkedAt,
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { cli: 'ng', watch: 'unknown', lastError: message, checkedAt }
  }
}

function summarizeCliFailure(result: {
  stderr?: unknown
  stdout?: unknown
  exitCode?: number | undefined
  signal?: string | undefined
}): string {
  const detail = outputText(result.stderr).trim() || outputText(result.stdout).trim()
  if (detail.length > 0) return detail
  if (typeof result.exitCode === 'number') return `exit ${result.exitCode}`
  if (result.signal) return `terminated by ${result.signal}`
  return `${ORBIT_DISPLAY_NAME} command failed (no exit code)`
}
