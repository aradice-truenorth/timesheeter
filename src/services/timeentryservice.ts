import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { ProcessedDayEntry } from "../dayentryprocessing";

// msdyn_timeentrytype global choice
const TIME_ENTRY_TYPE_WORK = 192350000;
// msdyn_timeentrystatus global choice
const TIME_ENTRY_STATUS_DRAFT = 192350000;

export class TimeEntryService {
    constructor(private dynamicsApi: MyDynamicsWebApi) {}

    public async uploadDayEntries(date: string, entries: ProcessedDayEntry[]): Promise<void> {
        for (const entry of entries) {
            await this.dynamicsApi.create({
                "msdyn_project@odata.bind": `/msdyn_projects(${entry.project.msdyn_projectid})`,
                "msdyn_projecttask@odata.bind": `/msdyn_projecttasks(${entry.task.msdyn_projecttaskid})`,
                msdyn_date: `${date}T00:00:00.000Z`,
                msdyn_duration: entry.minutes,
                msdyn_description: entry.qualifier,
                msdyn_type: TIME_ENTRY_TYPE_WORK,
                msdyn_entrystatus: TIME_ENTRY_STATUS_DRAFT,
            }, "msdyn_timeentries");
        }
    }
}
