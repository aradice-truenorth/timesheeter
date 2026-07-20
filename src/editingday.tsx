import { useEffect, useState } from "react";
import { processDayEntries, ProcessedDayEntry } from "./dayentryprocessing";
import Loading from "./loading";
import VerticalContent from "./verticalcontent";

export interface EditingDayProps {
    date: string; // ISO date string
    onExit: () => void;
    onUploaded: () => void;
}

const ADJUSTMENT_MINUTES = 15;

const formatDuration = (minutes: number): string => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const EditingDay: React.FunctionComponent<EditingDayProps> = ({ date, onExit, onUploaded }) => {
    const [rows, setRows] = useState<ProcessedDayEntry[] | null>(null);
    const [uploading, setUploading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.mainProcess.getAllRecordedData().then((allData) => {
            setRows(processDayEntries(allData[date] || []));
        });
    }, [date]);

    const adjustRow = (index: number, delta: number) => {
        setRows((current) => {
            if (!current) {
                return current;
            }
            const updated = current.slice();
            updated[index] = { ...updated[index], minutes: Math.max(0, updated[index].minutes + delta) };
            return updated;
        });
    };

    const updateQualifier = (index: number, qualifier: string) => {
        setRows((current) => {
            if (!current) {
                return current;
            }
            const updated = current.slice();
            updated[index] = { ...updated[index], qualifier };
            return updated;
        });
    };

    const handleExit = () => {
        if (window.confirm("Exit without saving? Any changes you've made on this screen will be lost.")) {
            onExit();
        }
    };

    const handleUpload = async () => {
        if (!rows) {
            return;
        }
        setUploading(true);
        setError(null);
        try {
            await window.mainProcess.uploadDayEntries(date, rows);
            onUploaded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload time entries.");
            setUploading(false);
        }
    };

    if (!rows) {
        return <Loading />;
    }

    const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);

    return (
        <VerticalContent>
            <h3 className="font-bold mb-2">{date}</h3>
            {rows.length === 0 ? (
                <p className="mb-4">No entries recorded for this day.</p>
            ) : (
                <table className="mb-4 w-full">
                    <thead>
                        <tr className="text-left">
                            <th>Project</th>
                            <th>Task</th>
                            <th>Qualifier</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index}>
                                <td>{row.project.msdyn_subject}</td>
                                <td>{row.task.msdyn_subject}</td>
                                <td>
                                    <input type="text" className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:text-gray-400"
                                        value={row.qualifier} onChange={(e) => updateQualifier(index, e.target.value)} disabled={uploading} />
                                </td>
                                <td>
                                    <button className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded px-2"
                                        onClick={() => adjustRow(index, -ADJUSTMENT_MINUTES)} disabled={uploading}>
                                        -15
                                    </button>
                                    {" "}{formatDuration(row.minutes)}{" "}
                                    <button className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded px-2"
                                        onClick={() => adjustRow(index, ADJUSTMENT_MINUTES)} disabled={uploading}>
                                        +15
                                    </button>
                                </td>
                            </tr>
                        ))}
                        <tr className="font-bold">
                            <td colSpan={3}>Total</td>
                            <td>{formatDuration(totalMinutes)}</td>
                        </tr>
                    </tbody>
                </table>
            )}

            {error && <div className="text-red-600 mb-2">{error}</div>}

            <div>
                <button className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded mr-2"
                    onClick={handleExit} disabled={uploading}>
                    Exit
                </button>
                <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleUpload} disabled={uploading || rows.length === 0}>
                    {uploading ? "Uploading..." : "Upload to Dynamics"}
                </button>
            </div>
        </VerticalContent>
    );
};
export default EditingDay;
