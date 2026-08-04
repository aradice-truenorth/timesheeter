
import { unlink } from "fs/promises";
import DynamicsWebApi, { OnTokenAcquiredCallback } from "dynamics-web-api";
import * as msal from "@azure/msal-node";
import { DataProtectionScope, FilePersistence, IPersistence, PersistenceCachePlugin, PersistenceCreator } from "@azure/msal-node-extensions";
import { shell } from "electron";
import { dynamicsResource, loginRequest, msalConfig } from "./authConfig";

interface TokenRequest {
    scopes: string[];
}

// PersistenceCachePlugin guards cache access with a "<cachePath>.lockfile" that only gets
// deleted on a clean unlock(). If the app was previously killed/crashed while that lock was
// held, the file is left behind and every future launch retries acquiring it for up to ~50s
// before giving up. This app only ever runs one instance at a time, so any lock file found at
// startup is stale by definition - clear it before it can cause that hang.
const removeStaleLockFile = async (cachePath: string): Promise<void> => {
    try {
        await unlink(`${cachePath}.lockfile`);
        console.log("Removed a leftover MSAL token cache lock file from a previous run");
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.log("Could not remove MSAL token cache lock file:", error);
        }
    }
};

// Prefers an OS-encrypted cache (DPAPI/Keychain/libsecret, via PersistenceCreator's
// auto-detection) but falls back to a plain file if that isn't usable in this environment -
// e.g. msal-node-extensions' prebuilt native DPAPI binding failing to load under Electron's
// bundled Node ABI. Still scoped to the per-user userData folder either way.
const createTokenCachePersistence = async (userDataPath: string): Promise<IPersistence> => {
    const cachePath = `${userDataPath}/msal-token-cache.json`;
    await removeStaleLockFile(cachePath);
    try {
        return await PersistenceCreator.createPersistence({
            cachePath,
            dataProtectionScope: DataProtectionScope.CurrentUser,
            serviceName: "timesheeter",
            accountName: "dynamics-login",
            usePlaintextFileOnLinux: false,
        });
    } catch (error) {
        console.log("Encrypted token cache unavailable in this environment, falling back to a plain file cache:", error);
        return FilePersistence.create(cachePath);
    }
};

export class MyDynamicsWebApi extends DynamicsWebApi {
    private constructor(clientApp: msal.PublicClientApplication) {
        super({
            webApiUrl: `${dynamicsResource}api/data/v9.2/`,
            onTokenRefresh: acquireTokenFactory(clientApp)
        } as DynamicsWebApi.Config);
    }

    // Persists the MSAL token cache to disk so a cached login survives an app restart instead
    // of requiring an interactive browser sign-in every time.
    public static async create(userDataPath: string): Promise<MyDynamicsWebApi> {
        const persistence = await createTokenCachePersistence(userDataPath);
        const clientApp = new msal.PublicClientApplication({
            ...msalConfig,
            cache: { cachePlugin: new PersistenceCachePlugin(persistence) }
        } as msal.Configuration);
        return new MyDynamicsWebApi(clientApp);
    }
}

export function acquireTokenFactory(clientApp: msal.PublicClientApplication) {
    let account: msal.AccountInfo | null = null;
    const getTokenInteractive = async (tokenRequest: TokenRequest): Promise<msal.AuthenticationResult | null> => {
        try {
            const openBrowser = async (url: string) => {
                await shell.openExternal(url);
            };

            const authResponse = await clientApp.acquireTokenInteractive({
                ...tokenRequest,
                openBrowser,
                successTemplate:
                    `
                    <html style="background-color: #001f3f; color: white;font-size: 64px;font-family: &quot;Helvetica&quot;;"><body><div style="text-align: center; padding: 50px 0;">
                            <h1 style="margin-bottom: 10px;">Successfully logged in!</h1>
                            <h3 style="">Please close this window and FILL IN YOUR TIMESHEET</h3>
                        </div>
                        </body>
                    </html>
                    `,
                errorTemplate:
                `
                <html style="background-color: #001f3f; color: white;font-size: 64px;font-family: &quot;Helvetica&quot;;"><body><div style="text-align: center; padding: 50px 0;">
                        <h1 style="margin-bottom: 10px;">Something went wrong!</h1>
                        <h3 style="">You'll have to fill your timesheet in old school instead</h3>
                    </div>
                    </body>
                </html>
                `
            });
            console.log(`Interactively logged in: ${authResponse.account?.username}`);
            account = authResponse.account;

            return authResponse;
        } catch (error) {
            throw error;
        }
    }


    return function acquireToken(callback: OnTokenAcquiredCallback): void {
        const callbackAndReturn = async (tokenRetriever: () => Promise<msal.AuthenticationResult | null>): Promise<void> => {
            const result = await tokenRetriever();
            if (!result) {
                console.log('Token acquisition returned no result');
                return;
            }
            callback(result.accessToken);
        };

        const acquire = async (): Promise<void> => {
            if (!account) {
                // Falls back to a cached account restored from the persisted token cache
                // (e.g. after an app restart) before ever prompting interactively.
                const cachedAccounts = await clientApp.getTokenCache().getAllAccounts();
                if (cachedAccounts.length > 0) {
                    [account] = cachedAccounts;
                    console.log(`Using cached login for ${account.username}`);
                }
            }

            if (!account) {
                await callbackAndReturn(() => getTokenInteractive(loginRequest));
                return;
            }

            const currentAccount = account;
            try {
                await callbackAndReturn(() => clientApp.acquireTokenSilent({ ...loginRequest, account: currentAccount }));
            } catch (error) {
                // Whatever the cause - expired/revoked token, a cache read failure, anything
                // else - fall back to interactive login rather than leaving the caller (and the
                // user, staring at "please log in") waiting on a callback that never comes.
                console.log('Silent token acquisition failed, acquiring token interactive:', error);
                account = null;
                await callbackAndReturn(() => getTokenInteractive(loginRequest));
            }
        };

        acquire();
    }
}


export { DynamicsWebApi }
