import React, { useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";


const msalInstance = new PublicClientApplication(msalConfig);
  
const root = createRoot(document.body);
const renderRoot = () => {
    root.render(
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>);
};

const App = () => {
    const { instance } = useMsal();
    const [authCode, setAuthCode ] = useState<string>(null)
    useEffect(() => {
        // @ts-ignore
        window.mainProcess.onAuthenticated((newAuthCode: string) => {
            setAuthCode(newAuthCode);
            renderRoot();
        })
    })
  
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
        {authCode ? <p>You are loggd in !</p>:<button onClick={handleLogin}>Login to Dynamics 365</button>}
      </div>
    );
  };

  renderRoot();
