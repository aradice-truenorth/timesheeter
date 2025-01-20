// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mainProcess', {
  onAuthenticated: (callback: (authCode: string) => void) => ipcRenderer.on('authenticated', (_event, value) => callback(value as string))
})