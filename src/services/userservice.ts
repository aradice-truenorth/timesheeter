import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { LoggedInAccount } from "../ipctypes";

export class UserService {
    constructor(private dynamicsApi: MyDynamicsWebApi) {}

    public async getLoggedInUser(): Promise<LoggedInAccount> {
        return await this.dynamicsApi.executeFetchXml('systemusers', `<fetch>
            <entity name="systemuser">
                <attribute name="fullname" />
                <attribute name="systemuserid" />
                <attribute name="internalemailaddress" />
                <filter>
                    <condition attribute="systemuserid" operator="eq-userid" />
                </filter>
            </entity>
            </fetch>`
        ).then((result: {value: {internalemailaddress: string; fullname: string;}[]}) => {
            return {
                email: result.value[0].internalemailaddress,
                name: result.value[0].fullname
            } as LoggedInAccount;
        });
    }
}