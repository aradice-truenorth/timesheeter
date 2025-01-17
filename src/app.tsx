import React from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";

const App = () => {
    const { instance } = useMsal();
  
    const handleLogin = async () => {
      try {
        await instance.loginRedirect(loginRequest);
      } catch (error) {
        console.error(error);
      }
    };
  
    return (
      <div>
        <h1>React Electron with Dynamics 365</h1>
        <button onClick={handleLogin}>Login to Dynamics 365</button>
      </div>
    );
  };

const msalInstance = new PublicClientApplication(msalConfig);
  
const root = createRoot(document.body);
root.render(
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>);
