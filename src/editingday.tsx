import { useEffect, useRef, useState } from "react";
import { processDayEntries, ProcessedDayEntry } from "./dayentryprocessing";
import FullWidthContent from "./fullwidthcontent";
import Loading from "./loading";
import { useEscapeKey } from "./useescapekey";
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

    useEscapeKey(handleExit, !uploading);

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
        <FullWidthContent>
        <VerticalContent>
        <form onSubmit={handleSubmit}>
            <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="text-lg font-semibold text-ink">{date}</h2>
                <span className="text-sm text-ink-soft">Total: <span className="font-semibold text-ink">{formatDuration(totalMinutes)}</span></span>
            </div>
            {rows.length === 0 ? (
                <p className="mb-4 text-sm text-ink-soft">No entries recorded for this day.</p>
            ) : (
                <table className="table-fluent mb-4" ref={tableRef}>
                    <thead>
                        <tr>
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
                                        className="field w-full"
                                        value={row.qualifier} onChange={(e) => updateQualifier(index, e.target.value)} disabled={uploading} />
                                </td>
                                <td className="whitespace-nowrap text-ink-soft">{formatDuration(row.loggedMinutes)}</td>
                                <td className="whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <button type="button" data-row={index} data-col="minus"
                                            className="btn-icon"
                                            onClick={() => adjustRow(index, -ADJUSTMENT_MINUTES)} disabled={uploading}>
                                            -
                                        </button>
                                        <span className="w-14 text-center">{formatDuration(row.minutes)}</span>
                                        <button type="button" data-row={index} data-col="plus"
                                            className="btn-icon"
                                            onClick={() => adjustRow(index, ADJUSTMENT_MINUTES)} disabled={uploading}>
                                            +
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        <tr className="font-semibold">
                            <td colSpan={4}>Total</td>
                            <td>{formatDuration(totalMinutes)}</td>
                        </tr>
                    </tbody>
                </table>
            )}

            {error && <div className="banner-error mb-3">{error}</div>}

            <div className="flex gap-2 pt-3 border-t border-line">
                <button type="submit" className="btn-primary"
                    disabled={uploading || rows.length === 0}>
                    {uploading ? "Uploading..." : "Upload to Dynamics"}
                </button>
                <button type="button" className="btn-secondary"
                    onClick={handleExit} disabled={uploading}>
                    Exit
                </button>
            </div>
        </form>
        </VerticalContent>
        </FullWidthContent>
    );
};
export default EditingDay;
