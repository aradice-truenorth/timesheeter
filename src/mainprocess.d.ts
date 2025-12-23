export interface IMainProcessAPI {
  onAuthenticated: (callback: (loggedInUser: LoggedInAccount) => void) => void
}

declare global {
  interface Window {
    mainProcess: IMainProcessAPI
  }
}