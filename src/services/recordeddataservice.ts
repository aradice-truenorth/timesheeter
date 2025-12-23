import { Project, ProjectTask } from "./projectservice";

export interface RecordedTimeEntry {
    startsAt: Date;
    endsAt: Date;
    project: Project;
    task: ProjectTask;
    qualifier: string;
}

export class RecordedDataService {
    public async getAll(): Promise<Record<string, RecordedTimeEntry[]>> {
        throw new Error("Not implemented");
    }
}