import DynamicsWebApi from "dynamics-web-api";
import { createContext } from "react";

export const DynamicsConfig = {
    webApiUrl: "https://truenorthit.crm11.dynamics.com/",
    dataApi: {path: 'data', version: '9.2'},
}

export const DynamicsWebApiContext = createContext<DynamicsWebApi | null>(null);