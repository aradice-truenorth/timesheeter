// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { LoggedInAccount } from './ipctypes';
import { IMainProcessAPI } from './mainprocess';

contextBridge.exposeInMainWorld('mainProcess', {
  onAuthenticated: (callback: (loggedInUser: LoggedInAccount) => void) => ipcRenderer.on('authenticated', (_event, value) => callback(value as LoggedInAccount))
} as IMainProcessAPI);