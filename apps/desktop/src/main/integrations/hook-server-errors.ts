import type { UiConfig } from '@planetz/shared'

export type HookServerErrorCode = 'EADDRINUSE' | 'HOOK_SERVER_START_FAILED'

/** Thrown when HookServer fails to bind; includes config persisted with hookServer.enabled=false. */
export class HookServerStartError extends Error {
  readonly code: HookServerErrorCode
  readonly port: number
  readonly configAfterRollback: UiConfig

  constructor(input: {
    code: HookServerErrorCode
    port: number
    configAfterRollback: UiConfig
    cause?: unknown
  }) {
    const message =
      input.code === 'EADDRINUSE'
        ? `Hook server port ${input.port} is already in use`
        : 'Hook server failed to start'
    super(message, { cause: input.cause })
    this.name = 'HookServerStartError'
    this.code = input.code
    this.port = input.port
    this.configAfterRollback = input.configAfterRollback
  }
}

export function readNodeErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

export function toHookServerStartError(
  error: unknown,
  port: number,
  configAfterRollback: UiConfig,
): HookServerStartError {
  if (error instanceof HookServerStartError) {
    return error
  }
  const code = readNodeErrorCode(error) === 'EADDRINUSE' ? 'EADDRINUSE' : 'HOOK_SERVER_START_FAILED'
  return new HookServerStartError({ code, port, configAfterRollback, cause: error })
}
