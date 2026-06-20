import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const secondInstanceHandler = vi.hoisted(() => ({
  current: null as (() => void) | null,
}))

const electronMocks = vi.hoisted(() => ({
  requestSingleInstanceLock: vi.fn(() => true),
  quit: vi.fn(),
  getAllWindows: vi.fn((): BrowserWindow[] => []),
}))

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: electronMocks.requestSingleInstanceLock,
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'second-instance') {
        secondInstanceHandler.current = handler
      }
    }),
    quit: electronMocks.quit,
  },
  BrowserWindow: {
    getAllWindows: electronMocks.getAllWindows,
  },
}))

import {
  focusExistingMainWindow,
  registerSingleInstanceAppHandlers,
} from '../lib/single-instance.js'

function mockWindow(overrides: Partial<BrowserWindow> = {}): BrowserWindow {
  return {
    isDestroyed: () => false,
    isMinimized: () => false,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    ...overrides,
  } as unknown as BrowserWindow
}

describe('single-instance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    secondInstanceHandler.current = null
    electronMocks.requestSingleInstanceLock.mockReturnValue(true)
    electronMocks.getAllWindows.mockReturnValue([])
  })

  it('registers lock and second-instance handler when lock is acquired', () => {
    const gotLock = registerSingleInstanceAppHandlers(() => null)
    expect(gotLock).toBe(true)
    expect(electronMocks.requestSingleInstanceLock).toHaveBeenCalledOnce()
    expect(secondInstanceHandler.current).toBeTypeOf('function')
  })

  it('quits immediately when lock is not acquired', () => {
    electronMocks.requestSingleInstanceLock.mockReturnValue(false)
    const gotLock = registerSingleInstanceAppHandlers(() => null)
    expect(gotLock).toBe(false)
    expect(electronMocks.quit).toHaveBeenCalledOnce()
  })

  it('focuses the bound main window on second-instance', () => {
    const win = mockWindow({ isMinimized: () => true })
    registerSingleInstanceAppHandlers(() => win)
    secondInstanceHandler.current?.()
    expect(win.restore).toHaveBeenCalledOnce()
    expect(win.show).toHaveBeenCalledOnce()
    expect(win.focus).toHaveBeenCalledOnce()
  })

  it('falls back to BrowserWindow.getAllWindows when main window is null', () => {
    const fallback = mockWindow()
    electronMocks.getAllWindows.mockReturnValue([fallback])
    focusExistingMainWindow(() => null)
    expect(fallback.show).toHaveBeenCalledOnce()
    expect(fallback.focus).toHaveBeenCalledOnce()
  })
})
