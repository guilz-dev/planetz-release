/** Vitest stub so main-process tests do not require a downloaded Electron binary. */

export class BrowserWindow {}

export const app = {
  getAppPath: () => process.cwd(),
  getPath: (name: string) => `/tmp/planetz-electron/${name}`,
  getName: () => 'planetz-test',
  isPackaged: false,
  requestSingleInstanceLock: () => true,
  on: () => {},
  quit: () => {},
  whenReady: () => Promise.resolve(),
}

export const shell = {
  openExternal: async () => {},
  showItemInFolder: () => {},
}

export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] as string[] }),
}

export const ipcMain = {
  handle: () => {},
  removeHandler: () => {},
}

export const ipcRenderer = {
  invoke: async () => {},
  on: () => {},
}

export const contextBridge = {
  exposeInMainWorld: () => {},
}

export class Notification {
  static isSupported(): boolean {
    return false
  }
}

export const nativeImage = {
  createFromPath: () => ({
    isEmpty: () => true,
  }),
}

export type IpcMainInvokeEvent = unknown
export type OpenDialogOptions = Record<string, unknown>
