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
      <div className="min-h-screen flex flex-col">
        <header className="bg-primary text-white px-6 py-3 shadow-sm flex items-center gap-2">
          <span className="font-semibold text-base tracking-wide">Timesheeter</span>
        </header>
        <main className="flex-1 flex flex-col items-center px-8 py-10">
          <div className="w-full max-w-3xl">
            {loggedInAccount ? (
                <Home />
            ):(
                <div className="card p-6 text-sm text-ink">
                    Use the browser tab that has been launched to log in.
                </div>
            )}
          </div>
        </main>
      </div>
    );
  };

  renderRoot();
