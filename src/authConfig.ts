export const msalConfig = {
    auth: {
      clientId: "479da59d-fc18-41fd-8fa1-b3137705f505",
      authority: "https://login.microsoftonline.com/f737f218-7da9-4dd1-b2b4-3ed14ff4a3f2",
      redirectUri: "timesheet://timesheet", // Same as the Azure AD Redirect URI
    },
  };
  
  export const loginRequest = {
    scopes: ["openid", "profile", "https://truenorthit.crm.dynamics.com/.default"],
  };