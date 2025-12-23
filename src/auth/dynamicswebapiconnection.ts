
import DynamicsWebApi, { OnTokenAcquiredCallback } from "dynamics-web-api";
import * as msal from "@azure/msal-node";
import { shell } from "electron";
import { dynamicsResource, loginRequest, msalConfig } from "./authConfig";

interface TokenRequest {
    scopes: string[];
}

export class MyDynamicsWebApi extends DynamicsWebApi {
    constructor() {
        const clientApp = new msal.PublicClientApplication({
            ...msalConfig
        } as msal.Configuration);
        super({
            webApiUrl: `${dynamicsResource}api/data/v9.2/`,
            onTokenRefresh: acquireTokenFactory(clientApp)
        } as DynamicsWebApi.Config);
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
        const callbackAndReturn = async (tokenRetriever: () => Promise<msal.AuthenticationResult>): Promise<void> => {
            const result = await tokenRetriever();
            callback(result.accessToken);
        };
        if (!account) {
            callbackAndReturn(() => getTokenInteractive(loginRequest));
            return;
        }
        try {
            callbackAndReturn(() => clientApp.acquireTokenSilent({...loginRequest, account}));
        } catch (error) {
            if (error instanceof msal.InteractionRequiredAuthError) {
                console.log('Silent token acquisition failed, acquiring token interactive');
                callbackAndReturn(() => getTokenInteractive(loginRequest));
            }

            console.log(error);
        }

    }
}


export { DynamicsWebApi }