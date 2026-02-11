import { useEffect, useState } from "react";
import { RecordedTimeEntry } from "./services/recordeddataservice";
import Loading from "./loading";
import RecordEntry, { SaveEntryResult } from "./recordentry";

const START_OF_DAY = "08:00";

const getStartOfDay = (): Date =>  {
    const now = new Date();
    const startOfDayParts = START_OF_DAY.split(":").map(part => parseInt(part, 10));
    now.setHours(startOfDayParts[0], startOfDayParts[1], 0, 0);
    return now;
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
    const [recordedData, setRecordedData] = useState<RecordedTimeEntry[]>(null);
    useEffect(() => {
        window.mainProcess.getAllRecordedData().then((allData) => {
            setRecordedData(allData[today] || []);
        });
    });
    const validateEntry = async (newEntry: RecordedTimeEntry): Promise<SaveEntryResult> => {
        const overlapsWith = recordedData.filter(existingEntry => 
            (newEntry.startsAt < existingEntry.endsAt && newEntry.endsAt > existingEntry.startsAt)
        );
        if (overlapsWith.length > 0) {
            return {
                success: false, 
                errorMessage: `The new entry overlaps with: ${overlapsWith.map(entry => `${entry.project.msdyn_subject} ${entry.startsAt.toISOString().substring(11, 16)}-${entry.endsAt.toISOString().substring(11, 16)}`).join("; ")}`
            };
        }
        const updatedEntries = [...recordedData, newEntry].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        await window.mainProcess.saveRecordedData(today, updatedEntries);
        setRecordedData(updatedEntries);
        return {success: true};
    };

    return (
        !recordedData ? <Loading /> : <RecordEntry 
            defaultStartsAt={recordedData.length > 0 ? recordedData[recordedData.length - 1].endsAt : getStartOfDay()} 
            saveEntry={validateEntry} />
    );
};
export default Recording;