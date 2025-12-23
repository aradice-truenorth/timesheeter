export interface IMainProcessAPI {
  onAuthenticated: (callback: (loggedInUser: LoggedInAccount) => void) => void,
  getAllProjects(): Promise<Project[]>,
  getTasksForProject(msdyn_projectid: string): Promise<ProjectTask[]>

}

declare global {
  interface Window {
    mainProcess: IMainProcessAPI
  }
}