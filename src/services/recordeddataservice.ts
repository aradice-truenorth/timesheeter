import { readFile, mkdir, readdir, writeFile } from "fs/promises";
import { Project, ProjectTask } from "./projectservice";

export interface SplitTimeEntry {
    startsAt: Date;
    endsAt: Date;
    isSplit: true;
    qualifier: string;
}

export interface WorkTimeEntry {
    startsAt: Date;
    endsAt: Date;
    isSplit: false;
    project: Project;
    task: ProjectTask;
    qualifier: string;
}

export type RecordedTimeEntry = SplitTimeEntry | WorkTimeEntry;

const DATE_KEYS = new Set(["startsAt", "endsAt"]);
const reviveDates = (key: string, value: unknown): unknown =>
    (DATE_KEYS.has(key) && typeof value === "string") ? new Date(value) : value;

export class RecordedDataService {
    filePattern = new RegExp("\\d{4}-\\d{2}-\\d{2}.json");
    recordedData: Promise<Record<string, RecordedTimeEntry[]>>;
    recordedDataPath: string;

    constructor(private dataPath: string) {
        this.recordedDataPath = `${this.dataPath}/recorded`;
        this.recordedData = mkdir(this.recordedDataPath, { recursive: true }).then(() => {
            return readdir(this.recordedDataPath).then((files: string[]) => {
                return Promise.all(files.filter(file => this.filePattern.test(file)).map(file => {
                    return readFile(`${this.recordedDataPath}/${file}`, 'utf-8').then((data) => {
                        return {name: file.substring(0, 10), entries: JSON.parse(data, reviveDates) as RecordedTimeEntry[]};
                    });
                })).then((allData: {name: string, entries: RecordedTimeEntry[]}[]) => {
                    const rval = {} as Record<string, RecordedTimeEntry[]>;
                    allData.forEach(data => {
                        rval[data.name] = data.entries;
                        console.log(`Loaded recorded data for ${data.name}, ${data.entries.length} entries`);
                    });
                    return rval;
                });
            });
        });
    }

    public async getAll(): Promise<Record<string, RecordedTimeEntry[]>> {
        return this.recordedData;
    }

    public async save(date: string, entries: RecordedTimeEntry[]): Promise<void> {
        const allData = await this.recordedData;
        allData[date] = entries;
        this.recordedData = Promise.resolve(allData);
        await writeFile(`${this.recordedDataPath}/${date}.json`, JSON.stringify(entries), {encoding: 'utf-8'});
    }
}