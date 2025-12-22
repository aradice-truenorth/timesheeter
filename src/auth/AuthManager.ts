import path from "path";
import * as msal from '@azure/msal-node'

import { DataProtectionScope, Environment, PersistenceCreator, PersistenceCachePlugin, IPersistenceConfiguration } from "@azure/msal-node-extensions";
import { loginRequest, msalConfig } from './authConfig'
import { shell } from "electron";


interface UserDetails {
    name: string;
    email: string;
}


interface TokenRequest {
    scopes: string[];
}


export default class AuthManager {

    private cachePath = path.join(Environment.getUserRootDirectory(), "./ts-auth-cache.json");
    private persistenceConfiguration: IPersistenceConfiguration;

    private account: msal.AccountInfo | null = null;

    private pca: msal.PublicClientApplication | null = null;
    private cache: msal.TokenCache | null = null;

    private bearerToken: string | null = null;

    private currentUser: UserDetails | null = null;

    constructor() {
        console.log(`CACHE PATH=${this.cachePath}, process.arch=${process.arch}`)
        this.persistenceConfiguration = {
            cachePath: this.cachePath,
            dataProtectionScope: DataProtectionScope.CurrentUser
        };
    }

    private async handleResponse(response: msal.AuthenticationResult): Promise<void> {
        if (response !== null) {
            this.account = response.account;
            this.bearerToken = response.accessToken;

            this.currentUser = {
                name: response.account.name,
                email: response.account.username
            };



        } 
    }

    public getBearerToken() {
        if (!this.pca) throw new Error('Call Setup first!');
        if (this.bearerToken === null) throw new Error('No token available');

        return this.bearerToken;
    }

    public getCurrentUser() {

        return this.currentUser;
    }

    public async login(loginOptions?: { optimistic: boolean }): Promise<void> {
        if (this.pca === null) throw new Error('Call Setup first!')

        const authResponse = await this.getToken({
            scopes: loginRequest.scopes,
        }, loginOptions);

        this.handleResponse(authResponse);
    }

    public async logout() {
        if (!this.account) return;
        await this.cache.removeAccount(this.account);
        this.account = null;
    }

    private async getAccount() {
        if (this.pca === null) throw new Error('Call Setup first!')

        const currentAccounts = await this.cache.getAllAccounts();

        if (!currentAccounts) {
            console.log('No accounts detected');
            return null;
        }

        if (currentAccounts.length > 1) {
            // Add choose account code here
            console.log('Multiple accounts detected, need to add choose account code.');
            return currentAccounts[0];
        } else if (currentAccounts.length === 1) {
            return currentAccounts[0];
        } else {
            return null;
        }
    }

    private async getToken(tokenRequest: TokenRequest, loginOptions?: { optimistic: boolean }): Promise<msal.AuthenticationResult | null> {
        if (this.pca === null) throw new Error('Call Setup first!')

        let authResponse;
        const account = this.account || (await this.getAccount());

        if (account) {
            authResponse = await this.getTokenSilent({ ...tokenRequest, account });
        } else if (!loginOptions || !loginOptions.optimistic) {
            authResponse = await this.getTokenInteractive(tokenRequest);
        }

        return authResponse || null;
    }

    private async getTokenInteractive(tokenRequest: TokenRequest): Promise<msal.AuthenticationResult | null> {
        if (this.pca === null) throw new Error('Call Setup first!')

        try {
            const openBrowser = async (url: string) => {
                await shell.openExternal(url);
            };

            const authResponse = await this.pca.acquireTokenInteractive({
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
                `,            });

            return authResponse;
        } catch (error) {
            throw error;
        }
    }

    private async getTokenSilent(tokenRequest: TokenRequest & { account: msal.AccountInfo }): Promise<msal.AuthenticationResult | null> {
        if (this.pca === null) throw new Error('Call Setup first!')

        try {
            return await this.pca.acquireTokenSilent(tokenRequest);
        } catch (error) {
            if (error instanceof msal.InteractionRequiredAuthError) {
                console.log('Silent token acquisition failed, acquiring token interactive');
                return await this.getTokenInteractive(tokenRequest);
            }

            console.log(error);
        }
    }

    public async Setup() {
        let publicClientConfig: msal.Configuration = { ...msalConfig };

        // Only use PersistenceCachePlugin on Windows
        if (process.platform === "win32") {
            try {
                // This code must run in the Electron main process for DPAPI to work
                const persistence = await PersistenceCreator.createPersistence(this.persistenceConfiguration);
                publicClientConfig = {
                    ...publicClientConfig,
                    cache: {
                        cachePlugin: new PersistenceCachePlugin(persistence)
                    }
                };
            } catch (err) {
                console.warn("Failed to initialize persistent cache, falling back to in-memory cache:", err);
            }
        } else {
            console.warn("Persistent cache is only supported on Windows. Using in-memory cache.");
        }

        this.pca = new msal.PublicClientApplication(publicClientConfig);
        this.cache = this.pca.getTokenCache();
    }




}