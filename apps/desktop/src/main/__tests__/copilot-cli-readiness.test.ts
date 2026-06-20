import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import {
  isCopilotAuthReady,
  isCopilotRuntimeReady,
  isGitHubCopilotCliAvailable,
} from '../planetz/copilot-cli-readiness.js'

describe('isGitHubCopilotCliAvailable', () => {
  afterEach(() => {
    vi.mocked(execa).mockReset()
  })

  it('returns true for GitHub Copilot CLI help', async () => {
    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' && target === 'copilot') return { exitCode: 0 } as never
      if (command === 'copilot' && target === '--help') {
        return { exitCode: 0, stdout: '@github/copilot GitHub Copilot CLI' } as never
      }
      return { exitCode: 1 } as never
    }) as never)

    await expect(isGitHubCopilotCliAvailable()).resolves.toBe(true)
  })

  it('returns false for AWS Copilot CLI help', async () => {
    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' && target === 'copilot') return { exitCode: 0 } as never
      if (command === 'copilot' && target === '--help') {
        return {
          exitCode: 0,
          stdout: 'Launch and manage containerized applications on AWS.',
        } as never
      }
      return { exitCode: 1 } as never
    }) as never)

    await expect(isGitHubCopilotCliAvailable()).resolves.toBe(false)
  })
})

describe('isCopilotRuntimeReady', () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    vi.mocked(execa).mockReset()
    process.env = { ...envBackup }
  })

  it('requires GitHub CLI and auth for runtime detection', async () => {
    vi.mocked(execa).mockImplementation((async (cmd: string | URL, args: unknown) => {
      const command = String(cmd)
      const target = Array.isArray(args) ? String(args[0] ?? '') : ''
      if (command === 'which' && target === 'copilot') return { exitCode: 0 } as never
      if (command === 'which' && target === 'gh') return { exitCode: 0 } as never
      if (command === 'copilot' && target === '--help') {
        return { exitCode: 0, stdout: '@github/copilot' } as never
      }
      if (command === 'gh' && target === 'auth') return { exitCode: 0 } as never
      return { exitCode: 1 } as never
    }) as never)

    await expect(isCopilotRuntimeReady()).resolves.toBe(true)
    await expect(isCopilotAuthReady()).resolves.toBe(true)
  })
})
