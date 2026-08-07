import { useEffect, useState } from "react";
import EditingDay from "./editingday";
import Loading from "./loading";
import { useEscapeKey } from "./useescapekey";
import VerticalContent from "./verticalcontent";

export interface EditingDaysListProps {
    onExit: () => void;
}

const SUCCESS_BANNER_TIMEOUT_MS = 5000;

const EditingDaysList: React.FunctionComponent<EditingDaysListProps> = ({ onExit }) => {
    const [availableDays, setAvailableDays] = useState<string[] | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadDays = () => {
        setAvailableDays(null);
        Promise.all([window.mainProcess.getAllRecordedData(), window.mainProcess.getUploadedDays()]).then(([allData, uploadedDays]) => {
            const uploaded = new Set(uploadedDays);
            const days = Object.keys(allData)
                .filter(date => allData[date].length > 0 && !uploaded.has(date))
                .sort((a, b) => (a < b ? 1 : (a > b ? -1 : 0)));
            setAvailableDays(days);
        });
    };

    useEffect(() => {
        loadDays();
    }, []);

    useEffect(() => {
        if (!successMessage) {
            return;
        }
        const timer = setTimeout(() => setSuccessMessage(null), SUCCESS_BANNER_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [successMessage]);

    // Only handles Escape for this screen's own "list" view - when a day is selected, EditingDay
    // is rendered instead and owns Escape itself (returning to this list, not past it).
    useEscapeKey(onExit, !selectedDate);

    if (selectedDate) {
        return <EditingDay date={selectedDate}
            onExit={() => { setSelectedDate(null); loadDays(); }}
            onUploaded={() => { setSelectedDate(null); loadDays(); setSuccessMessage("Time entries uploaded successfully."); }} />;
    }

    if (!availableDays) {
        return <Loading />;
    }

    return (
        <VerticalContent>
            <h2 className="text-lg font-semibold text-ink mb-4">Edit and Upload Entries</h2>
            {successMessage && <div className="banner-success mb-4">{successMessage}</div>}
            {availableDays.length === 0
                ? <p className="mb-4 text-sm text-ink-soft">No days available to edit.</p>
                : (
                    <div className="flex flex-col gap-2 mb-4">
                        {availableDays.map(date => (
                            <button key={date} className="btn-secondary justify-start w-fit"
                                onClick={() => setSelectedDate(date)}>
                                {date}
                            </button>
                        ))}
                    </div>
                )}
            <button className="btn-secondary w-fit"
                onClick={onExit}>
                Exit
            </button>
        </VerticalContent>
    );
};
export default EditingDaysList;
