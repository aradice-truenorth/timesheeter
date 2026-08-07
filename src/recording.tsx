import { useEffect, useState } from "react";
import { RecordedTimeEntry, WorkTimeEntry } from "./services/recordeddataservice";
import Loading from "./loading";
import RecordEntry, { MostRecentlyUsedEntry, RecentQualifierUsage, SaveEntryResult } from "./recordentry";
import { useEscapeKey } from "./useescapekey";
import VerticalContent from "./verticalcontent";

const START_OF_DAY = "08:00";
const MAX_MOST_RECENTLY_USED = 10;
const RECENT_QUALIFIER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const getStartOfDay = (): Date =>  {
    const now = new Date();
    const startOfDayParts = START_OF_DAY.split(":").map(part => parseInt(part, 10));
    now.setHours(startOfDayParts[0], startOfDayParts[1], 0, 0);
    return now;
}

const mruKey = (item: MostRecentlyUsedEntry): string => `${item.project.msdyn_projectid}|${item.task.msdyn_projecttaskid}|${item.qualifier}`;

const describeEntry = (entry: RecordedTimeEntry): string =>
    entry.isSplit ? "Split" : `${entry.project.msdyn_subject} / ${entry.task.msdyn_subject}`;

const computeMostRecentlyUsed = (allData: Record<string, RecordedTimeEntry[]>): MostRecentlyUsedEntry[] => {
    const allEntries: RecordedTimeEntry[] = Object.keys(allData).reduce((acc: RecordedTimeEntry[], date) => acc.concat(allData[date]), []);
    const workEntries = allEntries.filter((entry): entry is WorkTimeEntry => !entry.isSplit);
    const sorted = workEntries.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

    const seen = new Set<string>();
    const result: MostRecentlyUsedEntry[] = [];
    for (const entry of sorted) {
        const item = { project: entry.project, task: entry.task, qualifier: entry.qualifier };
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

const computeRecentQualifierUsage = (allData: Record<string, RecordedTimeEntry[]>): RecentQualifierUsage[] => {
    const cutoff = Date.now() - RECENT_QUALIFIER_WINDOW_MS;
    const allEntries: RecordedTimeEntry[] = Object.keys(allData).reduce((acc: RecordedTimeEntry[], date) => acc.concat(allData[date]), []);
    const workEntries = allEntries.filter((entry): entry is WorkTimeEntry => !entry.isSplit && entry.startsAt.getTime() >= cutoff);
    const sorted = workEntries.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
    return sorted.map(entry => ({
        projectId: entry.project.msdyn_projectid,
        taskId: entry.task.msdyn_projecttaskid,
        qualifier: entry.qualifier,
    }));
}

export interface RecordingProps {
    onExit: () => void;
}

const Recording: React.FunctionComponent<RecordingProps> = ({ onExit }) => {
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
    const [recentQualifierUsage, setRecentQualifierUsage] = useState<RecentQualifierUsage[]>([]);
    const [dayAlreadyUploaded, setDayAlreadyUploaded] = useState<boolean | null>(null);
    useEffect(() => {
        window.mainProcess.getAllRecordedData().then((allData) => {
            setRecordedData(allData[today] || []);
            setMostRecentlyUsed(computeMostRecentlyUsed(allData));
            setRecentQualifierUsage(computeRecentQualifierUsage(allData));
        });
        window.mainProcess.getUploadedDays().then((uploadedDays) => {
            setDayAlreadyUploaded(uploadedDays.indexOf(today) !== -1);
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
            const newItem = { project: newEntry.project, task: newEntry.task, qualifier: newEntry.qualifier };
            const newKey = mruKey(newItem);
            setMostRecentlyUsed((current) => [
                newItem,
                ...current.filter((item) => mruKey(item) !== newKey)
            ].slice(0, MAX_MOST_RECENTLY_USED));
            if (newEntry.qualifier) {
                setRecentQualifierUsage((current) => [
                    { projectId: newEntry.project.msdyn_projectid, taskId: newEntry.task.msdyn_projecttaskid, qualifier: newEntry.qualifier },
                    ...current
                ]);
            }
        }
        return {success: true};
    };

    // Only handles Escape for the "already uploaded" dead-end below - RecordEntry receives this
    // same onExit and owns Escape itself in the normal (not-yet-uploaded) case.
    useEscapeKey(onExit, dayAlreadyUploaded === true);

    if (!recordedData || dayAlreadyUploaded === null) {
        return <Loading />;
    }

    if (dayAlreadyUploaded) {
        return (
            <VerticalContent>
                <p className="mb-4 text-sm text-ink">Today's time has already been uploaded and can no longer be recorded against.</p>
                <button className="btn-secondary w-fit" onClick={onExit}>
                    Exit
                </button>
            </VerticalContent>
        );
    }

    const totalMinutesToday = recordedData.reduce((sum, entry) => sum + (entry.endsAt.getTime() - entry.startsAt.getTime()) / 60000, 0);

    return (
        <RecordEntry
            lastEntryEndsAt={recordedData.length > 0 ? recordedData[recordedData.length - 1].endsAt : null}
            startOfDayAt={getStartOfDay()}
            mostRecentlyUsed={mostRecentlyUsed}
            recentQualifierUsage={recentQualifierUsage}
            totalMinutesToday={totalMinutesToday}
            saveEntry={validateEntry}
            onExit={onExit} />
    );
};
export default Recording;