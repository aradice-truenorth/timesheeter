import { useEffect, useState } from "react";
import EditingDay from "./editingday";
import Loading from "./loading";
import VerticalContent from "./verticalcontent";

export interface EditingDaysListProps {
    onExit: () => void;
}

const EditingDaysList: React.FunctionComponent<EditingDaysListProps> = ({ onExit }) => {
    const [availableDays, setAvailableDays] = useState<string[] | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

    if (selectedDate) {
        return <EditingDay date={selectedDate} onExit={() => { setSelectedDate(null); loadDays(); }} />;
    }

    if (!availableDays) {
        return <Loading />;
    }

    return (
        <VerticalContent>
            {availableDays.length === 0
                ? <p className="mb-4">No days available to edit.</p>
                : availableDays.map(date => (
                    <button key={date} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded block mb-2"
                        onClick={() => setSelectedDate(date)}>
                        {date}
                    </button>
                ))}
            <button className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded block mt-4"
                onClick={onExit}>
                Exit
            </button>
        </VerticalContent>
    );
};
export default EditingDaysList;
