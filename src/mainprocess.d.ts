import { LoggedInAccount } from './ipctypes';
import { Project, ProjectTask } from './services/projectservice';
import { RecordedTimeEntry } from './services/recordeddataservice';
import { ProcessedDayEntry } from './dayentryprocessing';

export interface IMainProcessAPI {
  onAuthenticated: (callback: (loggedInUser: LoggedInAccount) => void) => void,
  getLoggedInUser(): Promise<LoggedInAccount>,
  getAllProjects(): Promise<Project[]>,
  getTasksForProject(msdyn_projectid: string): Promise<ProjectTask[]>
  getAllRecordedData(): Promise<Record<string, RecordedTimeEntry[]>>,
  saveRecordedData(date: string, entries: RecordedTimeEntry[]): Promise<void>,
  getUploadedDays(): Promise<string[]>,
  uploadDayEntries(date: string, entries: ProcessedDayEntry[]): Promise<void>
}

declare global {
  interface Window {
    mainProcess: IMainProcessAPI
  }
}
