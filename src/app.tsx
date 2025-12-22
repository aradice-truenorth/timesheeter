import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LoggedInAccount } from './ipctypes';
import Home from './home';
import { DynamicsConfig, DynamicsWebApiContext } from './services/dynamicswebapiconnection';
import DynamicsWebApi from 'dynamics-web-api';

const root = createRoot(document.body);
const renderRoot = () => {
    root.render(
          <App />
        );
};

const App = () => {
    const [loggedInAccount, setLoggedInAccount ] = useState<LoggedInAccount>(null)
    useEffect(() => {
        // @ts-ignore
        window.mainProcess.onAuthenticated((loggedInUser: LoggedInAccount) => {
            setLoggedInAccount(loggedInUser);
        })
    })
  
    return (
      <div>
        {loggedInAccount ? (
          <DynamicsWebApiContext value={new DynamicsWebApi({
            ...DynamicsConfig,
            onTokenRefresh: () => loggedInAccount.accessToken
          } as DynamicsWebApi.Config)}>
            <Home />
          </DynamicsWebApiContext>
        ):<p>Use the browser tab that has been launched to log in</p>}
      </div>
    );
  };

  renderRoot();
