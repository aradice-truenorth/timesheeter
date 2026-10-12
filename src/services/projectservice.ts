import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { caseNumbersMissingTitles, withCaseTitle } from "../casetitles";

export interface Project {
    msdyn_projectid: string;
    msdyn_subject: string;
}

export interface ProjectTask {
    msdyn_projecttaskid: string;
    msdyn_subject: string;
    // Title of the support case (incident) a "CAS-" task relates to. Display only - never uploaded.
    caseTitle?: string;
}

interface Incident {
    ticketnumber: string;
    title: string;
}

// Keeps the OR-ed filter comfortably inside URL length limits.
const CASE_LOOKUP_BATCH_SIZE = 25;

export class ProjectService {
    constructor(private dynamicsApi: MyDynamicsWebApi) {}

    public async getAllProjects(): Promise<Project[]> {
        return await this.dynamicsApi.retrieveMultipleRequest<Project>({
            collection: 'msdyn_projects',
            select: ['msdyn_projectid', 'msdyn_subject'],
            filter: `statecode eq 0`,
            orderBy: ['msdyn_subject']
        }).then((result) => {
            return result.value ?? [];
        });
    }

    public async getTasksForProject(msdyn_projectid: string): Promise<ProjectTask[]> {
        const tasks = (await this.dynamicsApi.retrieveMultipleRequest<ProjectTask>({
            collection: 'msdyn_projecttasks',
            select: ['msdyn_projecttaskid', 'msdyn_subject'],
            filter: `statecode eq 0 and _msdyn_project_value eq ${msdyn_projectid}`,
            orderBy: ['msdyn_subject']
        })).value ?? [];
        const caseTitles = await this.getCaseTitles(caseNumbersMissingTitles(tasks));
        return tasks.map(task => withCaseTitle(task, caseTitles));
    }

    // Maps upper-cased case numbers to incident titles. Includes resolved/cancelled cases, since
    // time is still logged against those. Failures (e.g. no read access to cases) are logged and
    // treated as "no titles found" - titles are a nicety, not something to block recording over.
    public async getCaseTitles(caseNumbers: string[]): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        for (let i = 0; i < caseNumbers.length; i += CASE_LOOKUP_BATCH_SIZE) {
            const batch = caseNumbers.slice(i, i + CASE_LOOKUP_BATCH_SIZE);
            try {
                const incidents = (await this.dynamicsApi.retrieveMultipleRequest<Incident>({
                    collection: 'incidents',
                    select: ['ticketnumber', 'title'],
                    filter: batch.map(caseNumber => `ticketnumber eq '${caseNumber.replace(/'/g, "''")}'`).join(' or ')
                })).value ?? [];
                for (const incident of incidents) {
                    if (incident.ticketnumber && incident.title) {
                        result[incident.ticketnumber.toUpperCase()] = incident.title;
                    }
                }
            } catch (err) {
                console.log(`Could not look up case titles for ${batch.join(', ')}:`, err);
            }
        }
        return result;
    }
}
