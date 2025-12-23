import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";

export interface Project {
    msdyn_projectid: string;
    msdyn_subject: string;
}

export interface ProjectTask {
    msdyn_projecttaskid: string;
    msdyn_subject: string;
}

export class ProjectService {
    constructor(private dynamicsApi: MyDynamicsWebApi) {}

    public async getAllProjects(): Promise<Project[]> {
        return await this.dynamicsApi.retrieveMultipleRequest<Project>({
            collection: 'msdyn_projects',
            select: ['msdyn_projectid', 'msdyn_subject'],
            filter: `statecode eq 0`,
            orderBy: ['msdyn_subject']
        }).then((result) => {
            return result.value;
        });
    }

    public async getTasksForProject(msdyn_projectid: string): Promise<ProjectTask[]> {
        return (await this.dynamicsApi.retrieveMultipleRequest<ProjectTask>({
            collection: 'msdyn_projecttasks',
            select: ['msdyn_projecttaskid', 'msdyn_subject'],
            filter: `statecode eq 0 and _msdyn_project_value eq ${msdyn_projectid}`,
            orderBy: ['msdyn_subject']
        })).value;
    }
}