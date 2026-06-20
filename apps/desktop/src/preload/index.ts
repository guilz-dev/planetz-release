import type { OrbitInteractiveStreamLine } from '@planetz/shared'
import { type BridgeInvokeSlice, buildBridgeInvokeMethods } from '@planetz/shared/bridge-preload'
import { BRIDGE_REVISION } from '@planetz/shared/bridge-revision'
import type { OrbitBridge } from '@planetz/shared/bridge-types'
import { IPC_CHANNELS } from '@planetz/shared/ipc-channels'
import type { AppState } from '@planetz/shared/types'
import { contextBridge, ipcRenderer } from 'electron'

const invokeMethods = buildBridgeInvokeMethods((channel, ...args) =>
  ipcRenderer.invoke(channel, ...args),
)

const bridge: OrbitBridge = {
  onStateUpdate(cb: (state: AppState) => void) {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => cb(state)
    ipcRenderer.on(IPC_CHANNELS.stateUpdate, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateUpdate, listener)
    }
  },
  onComposerSessionStream(cb: (line: OrbitInteractiveStreamLine) => void) {
    const listener = (_event: Electron.IpcRendererEvent, line: OrbitInteractiveStreamLine) =>
      cb(line)
    ipcRenderer.on(IPC_CHANNELS.composerSessionStream, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.composerSessionStream, listener)
    }
  },
  onUiFocusTask(cb: (taskId: string) => void) {
    const listener = (_event: Electron.IpcRendererEvent, taskId: string) => cb(taskId)
    ipcRenderer.on(IPC_CHANNELS.uiFocusTask, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.uiFocusTask, listener)
    }
  },
  ...(invokeMethods as BridgeInvokeSlice),
}

contextBridge.exposeInMainWorld('orbit', bridge)
contextBridge.exposeInMainWorld('orbitMeta', { revision: BRIDGE_REVISION })
