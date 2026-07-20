import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LoggedInAccount } from './ipctypes';
import Home from './home';

const root = createRoot(document.body);
const renderRoot = () => {
    root.render(
          <App />
        );
};

const App = () => {
    const [loggedInAccount, setLoggedInAccount ] = useState<LoggedInAccount | null>(null)
    useEffect(() => {
        window.mainProcess.onAuthenticated((loggedInUser: LoggedInAccount) => {
            setLoggedInAccount(loggedInUser);
        })
        // Covers any remount that happens after the one-time 'authenticated' push above has
        // already fired (e.g. a dev-mode hot reload) - without this, such a remount would be
        // stuck showing the login prompt forever, since the main process never re-sends it.
        window.mainProcess.getLoggedInUser().then(setLoggedInAccount).catch(() => {
            // Not logged in yet; onAuthenticated above will pick it up once login completes.
        });
    }, [])
  
    return (
      <div>
        {loggedInAccount ? (
            <Home />
        ):<p>Use the browser tab that has been launched to log in</p>}
      </div>
    );
  };

  renderRoot();
