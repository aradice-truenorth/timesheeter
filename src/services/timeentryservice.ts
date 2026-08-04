import { MyDynamicsWebApi } from "../auth/dynamicswebapiconnection";
import { ProcessedDayEntry } from "../dayentryprocessing";
import { UserService } from "./userservice";

// msdyn_timeentrytype global choice
const TIME_ENTRY_TYPE_WORK = 192350000;

const PROJECT_SERVICE_TIME_ENTRY_SETTING_NAME = "Project Service";

interface TimeEntrySetting {
    msdyn_timeentrysettingid: string;
}

export class TimeEntryService {
    private timeEntrySettingId: Promise<string> | null = null;

    constructor(private dynamicsApi: MyDynamicsWebApi, private userService: UserService) {}

    public async uploadDayEntries(date: string, entries: ProcessedDayEntry[]): Promise<void> {
        const [loggedInUser, timeEntrySettingId] = await Promise.all([
            this.userService.getLoggedInUser(),
            this.getProjectServiceTimeEntrySettingId(),
        ]);

        if (!loggedInUser.bookableresourcecategoryid) {
            throw new Error("Could not determine your bookable resource category in Dynamics - time entries cannot be uploaded.");
        }

        for (const entry of entries) {
            await this.dynamicsApi.create({
                "msdyn_project@odata.bind": `/msdyn_projects(${entry.project.msdyn_projectid})`,
                "msdyn_projectTask@odata.bind": `/msdyn_projecttasks(${entry.task.msdyn_projecttaskid})`,
                "msdyn_resourceCategory@odata.bind": `/bookableresourcecategories(${loggedInUser.bookableresourcecategoryid})`,
                "msdyn_timeentrysettingId@odata.bind": `/msdyn_timeentrysettings(${timeEntrySettingId})`,
                msdyn_date: `${date}T00:00:00.000Z`,
                msdyn_duration: entry.minutes,
                msdyn_description: entry.qualifier,
                msdyn_type: TIME_ENTRY_TYPE_WORK,
            }, "msdyn_timeentries");
        }
    }

    // Cached across uploads - this is a fixed lookup value, not per-entry data. Resets itself
    // on failure so a transient error doesn't permanently poison future uploads.
    private async getProjectServiceTimeEntrySettingId(): Promise<string> {
        if (!this.timeEntrySettingId) {
            this.timeEntrySettingId = this.dynamicsApi.retrieveMultipleRequest<TimeEntrySetting>({
                collection: "msdyn_timeentrysettings",
                select: ["msdyn_timeentrysettingid"],
                filter: `msdyn_name eq '${PROJECT_SERVICE_TIME_ENTRY_SETTING_NAME}'`,
            }).then((result) => {
                const setting = result.value?.[0];
                if (!setting) {
                    throw new Error(`Could not find the "${PROJECT_SERVICE_TIME_ENTRY_SETTING_NAME}" time entry setting in Dynamics.`);
                }
                return setting.msdyn_timeentrysettingid;
            });
            this.timeEntrySettingId.catch(() => {
                this.timeEntrySettingId = null;
            });
        }
        return this.timeEntrySettingId;
    }
}
