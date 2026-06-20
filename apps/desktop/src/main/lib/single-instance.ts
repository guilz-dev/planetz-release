import { app, BrowserWindow } from 'electron'

/** Brings an existing window to the foreground (used for second-instance handoff). */
export function focusExistingMainWindow(getWindow: () => BrowserWindow | null): void {
  const primary = getWindow()
  if (primary && !primary.isDestroyed()) {
    if (primary.isMinimized()) primary.restore()
    primary.show()
    primary.focus()
    return
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return
  }
}

/**
 * Ensures only one Planetz desktop instance runs per userData profile.
 * @returns `true` when this process owns the lock and should continue startup.
 */
export function registerSingleInstanceAppHandlers(getWindow: () => BrowserWindow | null): boolean {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', () => {
    focusExistingMainWindow(getWindow)
  })

  return true
}
