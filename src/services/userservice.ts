import { FetchXmlResponse } from "dynamics-web-api";
import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { LoggedInAccount } from "../ipctypes";

interface DynamicsUserInfo {internalemailaddress: string; fullname: string; systemuserid: string;}

export class UserService {
    constructor(private dynamicsApi: MyDynamicsWebApi) {}

    public async getLoggedInUser(): Promise<LoggedInAccount> {
        return await this.dynamicsApi.executeFetchXml<DynamicsUserInfo >('systemusers', `<fetch>
            <entity name="systemuser">
                <attribute name="fullname" />
                <attribute name="systemuserid" />
                <attribute name="internalemailaddress" />
                <filter>
                    <condition attribute="systemuserid" operator="eq-userid" />
                </filter>
            </entity>
            </fetch>`
        ).then((result: FetchXmlResponse<DynamicsUserInfo>) => {
            const currentUser = result.value?.[0] as DynamicsUserInfo;
            return {
                email: currentUser.internalemailaddress,
                name: currentUser.fullname,
                systemuserid: currentUser.systemuserid
            } as LoggedInAccount;
        });
    }
}