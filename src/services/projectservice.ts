import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { caseNumbersOf, extractCaseNumber, withCaseTitle } from "../casetitles";

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
    // 0 = Active, 1 = Resolved, 2 = Cancelled.
    statecode: number;
}

const INCIDENT_STATE_ACTIVE = 0;

// Keeps the OR-ed filter comfortably inside URL length limits.
const CASE_LOOKUP_BATCH_SIZE = 25;

const titlesOf = (cases: Record<string, Incident>): Record<string, string> => {
    const titles: Record<string, string> = {};
    for (const caseNumber of Object.keys(cases)) {
        if (cases[caseNumber].title) {
            titles[caseNumber] = cases[caseNumber].title;
        }
    }
    return titles;
};

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

    // Support-call tasks whose case is no longer active (resolved or cancelled) are left out, so
    // they can't be picked for new time. A task whose case can't be found, or can't be looked up,
    // is still listed.
    public async getTasksForProject(msdyn_projectid: string): Promise<ProjectTask[]> {
        const tasks = (await this.dynamicsApi.retrieveMultipleRequest<ProjectTask>({
            collection: 'msdyn_projecttasks',
            select: ['msdyn_projecttaskid', 'msdyn_subject'],
            filter: `statecode eq 0 and _msdyn_project_value eq ${msdyn_projectid}`,
            orderBy: ['msdyn_subject']
        })).value ?? [];
        const cases = await this.lookUpCases(caseNumbersOf(tasks));
        const caseTitles = titlesOf(cases);
        return tasks
            .filter(task => {
                const caseNumber = extractCaseNumber(task.msdyn_subject);
                const found = caseNumber ? cases[caseNumber] : undefined;
                return !found || found.statecode === INCIDENT_STATE_ACTIVE;
            })
            .map(task => withCaseTitle(task, caseTitles));
    }

    // Maps upper-cased case numbers to incident titles. Includes resolved/cancelled cases, since
    // time is still logged against those. Failures (e.g. no read access to cases) are logged and
    // treated as "no titles found" - titles are a nicety, not something to block recording over.
    public async getCaseTitles(caseNumbers: string[]): Promise<Record<string, string>> {
        return titlesOf(await this.lookUpCases(caseNumbers));
    }

    // Maps upper-cased case numbers to the incidents found for them. Cases in a batch whose lookup
    // fails are logged and simply missing from the result.
    private async lookUpCases(caseNumbers: string[]): Promise<Record<string, Incident>> {
        const result: Record<string, Incident> = {};
        for (let i = 0; i < caseNumbers.length; i += CASE_LOOKUP_BATCH_SIZE) {
            const batch = caseNumbers.slice(i, i + CASE_LOOKUP_BATCH_SIZE);
            try {
                const incidents = (await this.dynamicsApi.retrieveMultipleRequest<Incident>({
                    collection: 'incidents',
                    select: ['ticketnumber', 'title', 'statecode'],
                    filter: batch.map(caseNumber => `ticketnumber eq '${caseNumber.replace(/'/g, "''")}'`).join(' or ')
                })).value ?? [];
                for (const incident of incidents) {
                    if (incident.ticketnumber) {
                        result[incident.ticketnumber.toUpperCase()] = incident;
                    }
                }
            } catch (err) {
                console.log(`Could not look up cases ${batch.join(', ')}:`, err);
            }
        }
        return result;
    }
}
