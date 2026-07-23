import { useEffect, useRef, useState } from "react";
import { Project, ProjectTask } from "./services/projectservice";
import { RecordedTimeEntry } from "./services/recordeddataservice";
import ComboBox from "./combobox";
import FullWidthContent from "./fullwidthcontent";
import { useEscapeKey } from "./useescapekey";
import VerticalContent from "./verticalcontent";

export interface SaveEntryResult {
    success: boolean;
    errorMessage?: string;
}

export interface MostRecentlyUsedEntry {
    project: Project;
    task: ProjectTask;
    qualifier: string;
}

export interface RecordEntryProps {
    lastEntryEndsAt: Date | null;
    startOfDayAt: Date;
    mostRecentlyUsed: MostRecentlyUsedEntry[];
    totalMinutesToday: number;
    saveEntry: (entry: RecordedTimeEntry) => Promise<SaveEntryResult>;
    onExit: () => void;
}

type StartMode = "lastEntry" | "startOfDay" | "custom";
type EndMode = "now" | "custom";
type WorkMode = "split" | "mru" | "custom";

const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const toTimeInputValue = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const fromTimeInputValue = (time: string, referenceDate: Date): Date => {
    const parts = time.split(":").map(part => parseInt(part, 10));
    const result = new Date(referenceDate);
    result.setHours(parts[0], parts[1], 0, 0);
    return result;
};

const mruKey = (item: MostRecentlyUsedEntry): string => `${item.project.msdyn_projectid}|${item.task.msdyn_projecttaskid}|${item.qualifier}`;

const formatDuration = (totalMinutes: number): string => {
    const rounded = Math.round(totalMinutes);
    return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
};

const RecordEntry: React.FunctionComponent<RecordEntryProps> = (props) => {
    const { lastEntryEndsAt, startOfDayAt, mostRecentlyUsed, totalMinutesToday, saveEntry, onExit } = props;

    const defaultStartMode: StartMode = lastEntryEndsAt ? "lastEntry" : "startOfDay";
    const [startMode, setStartMode] = useState<StartMode>(defaultStartMode);
    const [startCustomTime, setStartCustomTime] = useState<string>(toTimeInputValue(lastEntryEndsAt ?? startOfDayAt));
    const [endMode, setEndMode] = useState<EndMode>("now");
    const [endCustomTime, setEndCustomTime] = useState<string>(toTimeInputValue(new Date()));

    const defaultWorkMode: WorkMode = mostRecentlyUsed.length > 0 ? "mru" : "custom";
    const [workMode, setWorkMode] = useState<WorkMode>(defaultWorkMode);
    const [selectedMruKey, setSelectedMruKey] = useState<string | null>(mostRecentlyUsed.length > 0 ? mruKey(mostRecentlyUsed[0]) : null);

    const [projects, setProjects] = useState<Project[] | null>(null);
    const [customProjectId, setCustomProjectId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<ProjectTask[] | null>(null);
    const [tasksReloading, setTasksReloading] = useState<boolean>(false);
    const [customTaskId, setCustomTaskId] = useState<string | null>(null);
    const [qualifier, setQualifier] = useState<string>(mostRecentlyUsed.length > 0 ? mostRecentlyUsed[0].qualifier : "");

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    useEscapeKey(onExit, !saving);

    const splitRadioRef = useRef<HTMLInputElement>(null);
    const mruRadioRef = useRef<HTMLInputElement>(null);
    const customRadioRef = useRef<HTMLInputElement>(null);

    const focusWorkModeRadio = (mode: WorkMode) => {
        const ref = mode === "split" ? splitRadioRef : (mode === "mru" ? mruRadioRef : customRadioRef);
        ref.current?.focus();
    };

    useEffect(() => {
        // Only on initial mount - the target radio here is deliberately the mount-time default.
        focusWorkModeRadio(defaultWorkMode);
    }, []);

    useEffect(() => {
        // Reacts to the actual (fresh) prop rather than the value clearForm() closed over when
        // the save that produced it was still in flight, so this is correct even for the very
        // first entry of the day (where clearForm() only sees "no last entry yet").
        if (lastEntryEndsAt) {
            setStartMode("lastEntry");
        }
    }, [lastEntryEndsAt]);

    useEffect(() => {
        window.mainProcess.getAllProjects().then(setProjects);
    }, []);

    useEffect(() => {
        if (!customProjectId) {
            setTasks(null);
            setCustomTaskId(null);
            return;
        }
        setTasks(null);
        setCustomTaskId(null);
        window.mainProcess.getTasksForProject(customProjectId).then(setTasks);
    }, [customProjectId]);

    const reloadTasks = () => {
        if (!customProjectId) {
            return;
        }
        setTasksReloading(true);
        window.mainProcess.getTasksForProject(customProjectId).then((reloaded) => {
            setTasks(reloaded);
            setTasksReloading(false);
        });
    };

    const resolveStart = (): Date => {
        if (startMode === "lastEntry") {
            return lastEntryEndsAt ?? startOfDayAt;
        }
        if (startMode === "startOfDay") {
            return startOfDayAt;
        }
        return fromTimeInputValue(startCustomTime, startOfDayAt);
    };

    const resolveEnd = (): Date => (endMode === "now" ? new Date() : fromTimeInputValue(endCustomTime, startOfDayAt));

    const clearForm = () => {
        setStartMode(lastEntryEndsAt ? "lastEntry" : "startOfDay");
        setStartCustomTime(toTimeInputValue(lastEntryEndsAt ?? startOfDayAt));
        setEndMode("now");
        setEndCustomTime(toTimeInputValue(new Date()));
        setWorkMode(mostRecentlyUsed.length > 0 ? "mru" : "custom");
        setSelectedMruKey(mostRecentlyUsed.length > 0 ? mruKey(mostRecentlyUsed[0]) : null);
        setCustomProjectId(null);
        setCustomTaskId(null);
        setQualifier(mostRecentlyUsed.length > 0 ? mostRecentlyUsed[0].qualifier : "");
        setErrorMessage(null);
    };

    const handleRecord = async () => {
        setErrorMessage(null);
        const startsAt = resolveStart();
        const endsAt = resolveEnd();
        if (endsAt <= startsAt) {
            setErrorMessage("End time must be after start time.");
            return;
        }

        let entry: RecordedTimeEntry;
        if (workMode === "split") {
            entry = { startsAt, endsAt, isSplit: true };
        } else if (workMode === "mru") {
            const selected = mostRecentlyUsed.find(item => mruKey(item) === selectedMruKey);
            if (!selected) {
                setErrorMessage("Select a recent project/task.");
                return;
            }
            entry = { startsAt, endsAt, isSplit: false, project: selected.project, task: selected.task, qualifier };
        } else {
            const project = (projects ?? []).find(p => p.msdyn_projectid === customProjectId);
            const task = (tasks ?? []).find(t => t.msdyn_projecttaskid === customTaskId);
            if (!project || !task) {
                setErrorMessage("Select a project and a task.");
                return;
            }
            entry = { startsAt, endsAt, isSplit: false, project, task, qualifier };
        }

        setSaving(true);
        const result = await saveEntry(entry);
        setSaving(false);
        if (result.success) {
            clearForm();
            focusWorkModeRadio(defaultWorkMode);
        } else {
            setErrorMessage(result.errorMessage ?? "Failed to save entry.");
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleRecord();
    };

    return (
        <FullWidthContent>
        <VerticalContent>
        <form onSubmit={handleSubmit}>
            <div className="mb-4 font-semibold">Recorded today: {formatDuration(totalMinutesToday)}</div>
            <div className="mb-4">
                <h3 className="font-bold mb-1">Time</h3>
                <div className="mb-2">
                    <h4 className="font-semibold text-sm text-gray-600">Start</h4>
                    <label className="block">
                        <input type="radio" name="startMode" checked={startMode === "lastEntry"} disabled={!lastEntryEndsAt}
                            onChange={() => setStartMode("lastEntry")} />
                        {" "}End of last entry{lastEntryEndsAt ? ` (${toTimeInputValue(lastEntryEndsAt)})` : " (none yet)"}
                    </label>
                    {!lastEntryEndsAt && (
                        <label className="block">
                            <input type="radio" name="startMode" checked={startMode === "startOfDay"}
                                onChange={() => setStartMode("startOfDay")} />
                            {" "}Start of day ({toTimeInputValue(startOfDayAt)})
                        </label>
                    )}
                    <label className="block">
                        <input type="radio" name="startMode" checked={startMode === "custom"}
                            onChange={() => setStartMode("custom")} />
                        {" "}Custom{" "}
                        <input type="time" value={startCustomTime} disabled={startMode !== "custom"}
                            onChange={(e) => setStartCustomTime(e.target.value)} />
                    </label>
                </div>
                <div>
                    <h4 className="font-semibold text-sm text-gray-600">End</h4>
                    <label className="block">
                        <input type="radio" name="endMode" checked={endMode === "now"}
                            onChange={() => setEndMode("now")} />
                        {" "}Now
                    </label>
                    <label className="block">
                        <input type="radio" name="endMode" checked={endMode === "custom"}
                            onChange={() => setEndMode("custom")} />
                        {" "}Custom{" "}
                        <input type="time" value={endCustomTime} disabled={endMode !== "custom"}
                            onChange={(e) => setEndCustomTime(e.target.value)} />
                    </label>
                </div>
            </div>

            <div className="mb-4">
                <h3 className="font-bold mb-1">Work</h3>
                <label className="block">
                    <input type="radio" name="workMode" ref={splitRadioRef} checked={workMode === "split"}
                        onChange={() => setWorkMode("split")} />
                    {" "}Split (shared out across today's other entries when reviewed)
                </label>
                <label className="block">
                    <input type="radio" name="workMode" ref={mruRadioRef} checked={workMode === "mru"} disabled={mostRecentlyUsed.length === 0}
                        onChange={() => setWorkMode("mru")} />
                    {" "}Recent
                </label>
                {workMode === "mru" && (
                    <table className="ml-6 mb-2">
                        <thead>
                            <tr className="text-left">
                                <th></th>
                                <th className="pr-4">Project</th>
                                <th className="pr-4">Task</th>
                                <th>Qualifier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mostRecentlyUsed.map((item) => {
                                const key = mruKey(item);
                                const selectItem = () => { setSelectedMruKey(key); setQualifier(item.qualifier); };
                                return (
                                    <tr key={key} className="cursor-pointer hover:bg-gray-100" onClick={selectItem}>
                                        <td>
                                            <input type="radio" name="mruEntry" checked={selectedMruKey === key} onChange={selectItem} />
                                        </td>
                                        <td className="pr-4">{item.project.msdyn_subject}</td>
                                        <td className="pr-4">{item.task.msdyn_subject}</td>
                                        <td>{item.qualifier}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <label className="block">
                    <input type="radio" name="workMode" ref={customRadioRef} checked={workMode === "custom"}
                        onChange={() => setWorkMode("custom")} />
                    {" "}Custom
                </label>
                {workMode === "custom" && (
                    <div className="ml-6 mb-2">
                        <div className="mb-2">
                            <ComboBox
                                options={(projects ?? []).map(p => ({ value: p.msdyn_projectid, label: p.msdyn_subject }))}
                                value={customProjectId}
                                onChange={setCustomProjectId}
                                placeholder={projects ? "Select a project..." : "Loading projects..."}
                                disabled={!projects} />
                        </div>
                        <div className="mb-2">
                            <ComboBox
                                options={(tasks ?? []).map(t => ({ value: t.msdyn_projecttaskid, label: t.msdyn_subject }))}
                                value={customTaskId}
                                onChange={setCustomTaskId}
                                placeholder={!customProjectId ? "Select a project first" : (tasks ? "Select a task..." : "Loading tasks...")}
                                disabled={!customProjectId || !tasks}
                                onReload={customProjectId ? reloadTasks : undefined}
                                reloading={tasksReloading} />
                        </div>
                    </div>
                )}
                {workMode !== "split" && (
                    <input type="text" className="border rounded px-2 py-1 w-full mt-1" placeholder="Qualifier (optional)"
                        value={qualifier} onChange={(e) => setQualifier(e.target.value)} />
                )}
            </div>

            {errorMessage && <div className="text-red-600 mb-2">{errorMessage}</div>}

            <div>
                <button type="button" className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2"
                    onClick={clearForm} disabled={saving}>
                    Clear
                </button>
                <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
                    disabled={saving}>
                    Record
                </button>
                <button type="button" className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                    onClick={onExit} disabled={saving}>
                    Exit
                </button>
            </div>
        </form>
        </VerticalContent>
        </FullWidthContent>
    );
};
export default RecordEntry;
