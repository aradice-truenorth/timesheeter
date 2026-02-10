// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { LoggedInAccount } from './ipctypes';
import { IMainProcessAPI } from './mainprocess';
import { RecordedTimeEntry } from './services/recordeddataservice';

contextBridge.exposeInMainWorld('mainProcess', {
  onAuthenticated: (callback: (loggedInUser: LoggedInAccount) => void) => ipcRenderer.on('authenticated', (_event, value) => callback(value as LoggedInAccount)),
  getAllProjects: () => ipcRenderer.invoke('get-all-projects'),
  getTasksForProject: (msdyn_projectid: string) => ipcRenderer.invoke('get-tasks-for-project', msdyn_projectid),
  getAllRecordedData: () => ipcRenderer.invoke('get-all-recorded-data'),
  saveRecordedData: (date: string, entries: RecordedTimeEntry[]) => ipcRenderer.invoke('save-recorded-data', date, entries)
} as IMainProcessAPI);