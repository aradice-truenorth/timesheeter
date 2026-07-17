import { useEffect, useState } from "react";
import { RecordedTimeEntry, WorkTimeEntry } from "./services/recordeddataservice";
import Loading from "./loading";
import RecordEntry, { MostRecentlyUsedEntry, SaveEntryResult } from "./recordentry";

const START_OF_DAY = "08:00";
const MAX_MOST_RECENTLY_USED = 10;

const getStartOfDay = (): Date =>  {
    const now = new Date();
    const startOfDayParts = START_OF_DAY.split(":").map(part => parseInt(part, 10));
    now.setHours(startOfDayParts[0], startOfDayParts[1], 0, 0);
    return now;
}

const mruKey = (item: MostRecentlyUsedEntry): string => `${item.project.msdyn_projectid}|${item.task.msdyn_projecttaskid}`;

const describeEntry = (entry: RecordedTimeEntry): string =>
    entry.isSplit ? "Split" : `${entry.project.msdyn_subject} / ${entry.task.msdyn_subject}`;

const computeMostRecentlyUsed = (allData: Record<string, RecordedTimeEntry[]>): MostRecentlyUsedEntry[] => {
    const allEntries: RecordedTimeEntry[] = Object.keys(allData).reduce((acc: RecordedTimeEntry[], date) => acc.concat(allData[date]), []);
    const workEntries = allEntries.filter((entry): entry is WorkTimeEntry => !entry.isSplit);
    const sorted = workEntries.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

    const seen = new Set<string>();
    const result: MostRecentlyUsedEntry[] = [];
    for (const entry of sorted) {
        const item = { project: entry.project, task: entry.task };
        const key = mruKey(item);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(item);
        if (result.length >= MAX_MOST_RECENTLY_USED) {
            break;
        }
    }
    return result;
}

const Recording = () => {
    /*
    Screen elements:
        1. Form elements:
          - "Time" group
            - Start time radio buttons
                End of last entry (time + ToString() of entry)
                Start of application (time)
                Custom (time picker)
            - End time radio buttons
                Now (time)
                Custom (time picker)
          - "Work" group with top level radio buttons
            - Split
            - MRU list (up to 10)
            - Custom
                - Project (dropdown)
                - Task (dropdown)
                - Qualifier
          - Clear & Record buttons

    Injected services:
        - ProjectsService
        - LocalStorageService

    */
    const today = new Date().toISOString().substring(0, 10);
    const [recordedData, setRecordedData] = useState<RecordedTimeEntry[] | null>(null);
    const [mostRecentlyUsed, setMostRecentlyUsed] = useState<MostRecentlyUsedEntry[]>([]);
    useEffect(() => {
        window.mainProcess.getAllRecordedData().then((allData) => {
            setRecordedData(allData[today] || []);
            setMostRecentlyUsed(computeMostRecentlyUsed(allData));
        });
    }, [today]);
    const validateEntry = async (newEntry: RecordedTimeEntry): Promise<SaveEntryResult> => {
        if (!recordedData) {
            throw new Error("validateEntry called before recorded data finished loading");
        }
        const overlapsWith = recordedData.filter(existingEntry =>
            (newEntry.startsAt < existingEntry.endsAt && newEntry.endsAt > existingEntry.startsAt)
        );
        if (overlapsWith.length > 0) {
            return {
                success: false,
                errorMessage: `The new entry overlaps with: ${overlapsWith.map(entry => `${describeEntry(entry)} ${entry.startsAt.toISOString().substring(11, 16)}-${entry.endsAt.toISOString().substring(11, 16)}`).join("; ")}`
            };
        }
        const updatedEntries = [...recordedData, newEntry].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        await window.mainProcess.saveRecordedData(today, updatedEntries);
        setRecordedData(updatedEntries);
        if (!newEntry.isSplit) {
            const newItem = { project: newEntry.project, task: newEntry.task };
            const newKey = mruKey(newItem);
            setMostRecentlyUsed((current) => [
                newItem,
                ...current.filter((item) => mruKey(item) !== newKey)
            ].slice(0, MAX_MOST_RECENTLY_USED));
        }
        return {success: true};
    };

    return (
        !recordedData ? <Loading /> : <RecordEntry
            lastEntryEndsAt={recordedData.length > 0 ? recordedData[recordedData.length - 1].endsAt : null}
            startOfDayAt={getStartOfDay()}
            mostRecentlyUsed={mostRecentlyUsed}
            saveEntry={validateEntry} />
    );
};
export default Recording;