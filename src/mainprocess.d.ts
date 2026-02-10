export interface IMainProcessAPI {
  onAuthenticated: (callback: (loggedInUser: LoggedInAccount) => void) => void,
  getAllProjects(): Promise<Project[]>,
  getTasksForProject(msdyn_projectid: string): Promise<ProjectTask[]>
  getAllRecordedData(): Promise<Record<string, RecordedTimeEntry[]>>,
  saveRecordedData(date: string, entries: RecordedTimeEntry[]): Promise<void>
}

declare global {
  interface Window {
    mainProcess: IMainProcessAPI
  }
}