import { FetchXmlResponse } from "dynamics-web-api";
import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { LoggedInAccount } from "../ipctypes";

interface DynamicsUserInfo {
    internalemailaddress: string;
    fullname: string;
    systemuserid: string;
    "BRC.bookableresourcecategoryid"?: string;
}

export class UserService {
    constructor(private dynamicsApi: MyDynamicsWebApi) {}

    public async getLoggedInUser(): Promise<LoggedInAccount> {
        return await this.dynamicsApi.executeFetchXml<DynamicsUserInfo>('systemusers', `<fetch top="50">
            <entity name="systemuser">
                <attribute name="fullname" />
                <attribute name="internalemailaddress" />
                <attribute name="systemuserid" />
                <filter>
                    <condition attribute="systemuserid" operator="eq-userid" />
                </filter>
                <link-entity name="bookableresource" from="userid" to="systemuserid" alias="BR">
                    <link-entity name="bookableresourcecategoryassn" from="resource" to="bookableresourceid" alias="BRCA">
                        <link-entity name="bookableresourcecategory" from="bookableresourcecategoryid" to="resourcecategory" alias="BRC">
                            <attribute name="name" />
                            <attribute name="bookableresourcecategoryid" />
                        </link-entity>
                    </link-entity>
                </link-entity>
            </entity>
            </fetch>`
        ).then((result: FetchXmlResponse<DynamicsUserInfo>) => {
            const currentUser = result.value?.[0] as DynamicsUserInfo;
            return {
                email: currentUser.internalemailaddress,
                name: currentUser.fullname,
                systemuserid: currentUser.systemuserid,
                bookableresourcecategoryid: currentUser["BRC.bookableresourcecategoryid"] ?? null
            } as LoggedInAccount;
        });
    }
}
