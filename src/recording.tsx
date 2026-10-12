import { useEffect, useState } from "react";
import { RecordedTimeEntry, WorkTimeEntry } from "./services/recordeddataservice";
import Loading from "./loading";
import RecordEntry, { MostRecentlyUsedEntry, RecentQualifierUsage, SaveEntryResult, UndoEntryResult, toTimeInputValue } from "./recordentry";
import { useEscapeKey } from "./useescapekey";
import VerticalContent from "./verticalcontent";

const MAX_MOST_RECENTLY_USED = 10;
const RECENT_QUALIFIER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_CHANGE_CHECK_INTERVAL_MS = 30 * 1000;
const DAY_CHANGED_MESSAGE = "The date has changed since this screen was loaded, so it has been refreshed for today. Please check the entry and try again.";

const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

// The local (not UTC) calendar date as YYYY-MM-DD - toISOString() would put entries made
// before 1am BST against the previous day.
const localDateKey = (date: Date): string => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

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
    const [screenOpenedAt] = useState<Date>(() => new Date());
    // Held in state (rather than recomputed per render) so that a screen left open overnight
    // notices the date change, reloads, and stops recording against yesterday.
    const [today, setToday] = useState<string>(() => localDateKey(new Date()));
    const [recordedData, setRecordedData] = useState<RecordedTimeEntry[] | null>(null);
    const [mostRecentlyUsed, setMostRecentlyUsed] = useState<MostRecentlyUsedEntry[]>([]);
    const [recentQualifierUsage, setRecentQualifierUsage] = useState<RecentQualifierUsage[]>([]);
    const [dayAlreadyUploaded, setDayAlreadyUploaded] = useState<boolean | null>(null);
    useEffect(() => {
        const checkForDayChange = () => setToday(localDateKey(new Date()));
        const interval = setInterval(checkForDayChange, DAY_CHANGE_CHECK_INTERVAL_MS);
        window.addEventListener("focus", checkForDayChange);
        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", checkForDayChange);
        };
    }, []);
    useEffect(() => {
        setRecordedData(null);
        setDayAlreadyUploaded(null);
        window.mainProcess.getAllRecordedData().then((allData) => {
            setRecordedData(allData[today] || []);
            setMostRecentlyUsed(computeMostRecentlyUsed(allData));
            setRecentQualifierUsage(computeRecentQualifierUsage(allData));
        });
        window.mainProcess.getUploadedDays().then((uploadedDays) => {
            setDayAlreadyUploaded(uploadedDays.indexOf(today) !== -1);
        });
    }, [today]);
    // Last line of defence if the day rolled over before the interval/focus check caught it.
    const dayHasChanged = (): boolean => {
        const actualToday = localDateKey(new Date());
        if (actualToday === today) {
            return false;
        }
        setToday(actualToday);
        return true;
    };

    const validateEntry = async (newEntry: RecordedTimeEntry): Promise<SaveEntryResult> => {
        if (!recordedData) {
            throw new Error("validateEntry called before recorded data finished loading");
        }
        if (dayHasChanged()) {
            return { success: false, errorMessage: DAY_CHANGED_MESSAGE };
        }
        const overlapsWith = recordedData.filter(existingEntry =>
            (newEntry.startsAt < existingEntry.endsAt && newEntry.endsAt > existingEntry.startsAt)
        );
        if (overlapsWith.length > 0) {
            return {
                success: false,
                errorMessage: `The new entry overlaps with: ${overlapsWith.map(entry => `${describeEntry(entry)} ${toTimeInputValue(entry.startsAt)}-${toTimeInputValue(entry.endsAt)}`).join("; ")}`
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

    const undoLastEntry = async (): Promise<UndoEntryResult> => {
        if (!recordedData || recordedData.length === 0) {
            return { success: false, errorMessage: "There is nothing to undo." };
        }
        if (dayHasChanged()) {
            return { success: false, errorMessage: DAY_CHANGED_MESSAGE };
        }
        const remainingEntries = recordedData.slice(0, -1);
        await window.mainProcess.saveRecordedData(today, remainingEntries);
        setRecordedData(remainingEntries);
        return {
            success: true,
            undoneEntry: recordedData[recordedData.length - 1],
            lastEntryEndsAt: remainingEntries.length > 0 ? remainingEntries[remainingEntries.length - 1].endsAt : null
        };
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
            key={today}
            lastEntryEndsAt={recordedData.length > 0 ? recordedData[recordedData.length - 1].endsAt : null}
            screenOpenedAt={screenOpenedAt}
            screenOpenedToday={localDateKey(screenOpenedAt) === today}
            mostRecentlyUsed={mostRecentlyUsed}
            recentQualifierUsage={recentQualifierUsage}
            totalMinutesToday={totalMinutesToday}
            saveEntry={validateEntry}
            undoLastEntry={undoLastEntry}
            onExit={onExit} />
    );
};
export default Recording;