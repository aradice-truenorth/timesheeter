import { useEffect, useRef, useState } from "react";
import { processDayEntries, ProcessedDayEntry } from "./dayentryprocessing";
import Loading from "./loading";
import VerticalContent from "./verticalcontent";

export interface EditingDayProps {
    date: string; // ISO date string
    onExit: () => void;
    onUploaded: () => void;
}

const ADJUSTMENT_MINUTES = 15;

const formatDuration = (totalMinutes: number): string => {
    const rounded = Math.round(totalMinutes);
    return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
};

const EditingDay: React.FunctionComponent<EditingDayProps> = ({ date, onExit, onUploaded }) => {
    const [rows, setRows] = useState<ProcessedDayEntry[] | null>(null);
    const [uploading, setUploading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

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

    // Up/Down moves to the same control (qualifier / minus / plus) in the adjacent row; Left/Right
    // hops between the minus and plus buttons within a row. Left/Right on the qualifier text input
    // is left alone so normal cursor movement while typing still works.
    const focusCell = (row: number, col: string) => {
        tableRef.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)?.focus();
    };

    const handleGridKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
        const target = e.target as HTMLElement;
        const rowAttr = target.getAttribute("data-row");
        const col = target.getAttribute("data-col");
        if (rowAttr === null || col === null) {
            return;
        }
        const row = parseInt(rowAttr, 10);
        if (e.key === "ArrowDown") {
            e.preventDefault();
            focusCell(row + 1, col);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            focusCell(row - 1, col);
        } else if (e.key === "ArrowLeft" && col === "plus") {
            e.preventDefault();
            focusCell(row, "minus");
        } else if (e.key === "ArrowRight" && col === "minus") {
            e.preventDefault();
            focusCell(row, "plus");
        }
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
            await window.mainProcess.uploadDayEntries(date, rows.filter(r => r.minutes > 0));
            onUploaded();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload time entries.");
            setUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleUpload();
    };

    if (!rows) {
        return <Loading />;
    }

    const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);

    return (
        <div className="w-screen ml-[calc(50%-50vw)] px-8">
        <VerticalContent>
        <form onSubmit={handleSubmit}>
            <h3 className="font-bold mb-2">{date}</h3>
            {rows.length === 0 ? (
                <p className="mb-4">No entries recorded for this day.</p>
            ) : (
                <table className="mb-4 w-full" ref={tableRef}>
                    <thead>
                        <tr className="text-left">
                            <th>Project</th>
                            <th>Task</th>
                            <th>Qualifier</th>
                            <th>Logged</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody onKeyDown={handleGridKeyDown}>
                        {rows.map((row, index) => (
                            <tr key={index}>
                                <td>{row.project.msdyn_subject}</td>
                                <td>{row.task.msdyn_subject}</td>
                                <td>
                                    <input type="text" data-row={index} data-col="qualifier"
                                        className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:text-gray-400"
                                        value={row.qualifier} onChange={(e) => updateQualifier(index, e.target.value)} disabled={uploading} />
                                </td>
                                <td className="whitespace-nowrap">{formatDuration(row.loggedMinutes)}</td>
                                <td className="whitespace-nowrap">
                                    <button type="button" data-row={index} data-col="minus"
                                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded px-2"
                                        onClick={() => adjustRow(index, -ADJUSTMENT_MINUTES)} disabled={uploading}>
                                        -
                                    </button>
                                    {" "}{formatDuration(row.minutes)}{" "}
                                    <button type="button" data-row={index} data-col="plus"
                                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded px-2"
                                        onClick={() => adjustRow(index, ADJUSTMENT_MINUTES)} disabled={uploading}>
                                        +
                                    </button>
                                </td>
                            </tr>
                        ))}
                        <tr className="font-bold">
                            <td colSpan={4}>Total</td>
                            <td>{formatDuration(totalMinutes)}</td>
                        </tr>
                    </tbody>
                </table>
            )}

            {error && <div className="text-red-600 mb-2">{error}</div>}

            <div>
                <button type="button" className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded mr-2"
                    onClick={handleExit} disabled={uploading}>
                    Exit
                </button>
                <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    disabled={uploading || rows.length === 0}>
                    {uploading ? "Uploading..." : "Upload to Dynamics"}
                </button>
            </div>
        </form>
        </VerticalContent>
        </div>
    );
};
export default EditingDay;
