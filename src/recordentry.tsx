import { useEffect, useMemo, useRef, useState } from "react";
import { Project, ProjectTask } from "./services/projectservice";
import { RecordedTimeEntry } from "./services/recordeddataservice";
import ComboBox from "./combobox";
import { taskDisplayName } from "./casetitles";
import QualifierInput from "./qualifierinput";
import FullWidthContent from "./fullwidthcontent";
import { useEscapeKey } from "./useescapekey";
import VerticalContent from "./verticalcontent";

const SUCCESS_BANNER_TIMEOUT_MS = 1000;

export interface SaveEntryResult {
    success: boolean;
    errorMessage?: string;
}

export interface UndoEntryResult {
    success: boolean;
    errorMessage?: string;
    undoneEntry?: RecordedTimeEntry;
    // End of whichever entry is now last for the day, after the undo.
    lastEntryEndsAt?: Date | null;
}

export interface MostRecentlyUsedEntry {
    project: Project;
    task: ProjectTask;
    qualifier: string;
}

export interface RecentQualifierUsage {
    projectId: string;
    taskId: string;
    qualifier: string;
}

export interface RecordEntryProps {
    lastEntryEndsAt: Date | null;
    screenOpenedAt: Date;
    // False if the screen has been open since a previous day.
    screenOpenedToday: boolean;
    mostRecentlyUsed: MostRecentlyUsedEntry[];
    recentQualifierUsage: RecentQualifierUsage[];
    totalMinutesToday: number;
    saveEntry: (entry: RecordedTimeEntry) => Promise<SaveEntryResult>;
    undoLastEntry: () => Promise<UndoEntryResult>;
    onExit: () => void;
}

type StartMode = "lastEntry" | "screenOpened" | "custom";
type EndMode = "now" | "custom";
type WorkMode = "split" | "mru" | "custom";

const pad2 = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

export const toTimeInputValue = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

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
    const { lastEntryEndsAt, screenOpenedAt, screenOpenedToday, mostRecentlyUsed, recentQualifierUsage, totalMinutesToday, saveEntry, undoLastEntry, onExit } = props;

    // "Start of recording" only makes sense for the first entry of the day, and only if the
    // screen was opened today.
    const screenOpenedAvailable = screenOpenedToday && !lastEntryEndsAt;
    const getDefaultStartMode = (lastEnd: Date | null): StartMode =>
        lastEnd ? "lastEntry" : (screenOpenedToday ? "screenOpened" : "custom");
    const getDefaultStartCustomTime = (lastEnd: Date | null): string =>
        toTimeInputValue(lastEnd ?? (screenOpenedToday ? screenOpenedAt : new Date()));

    const [startMode, setStartMode] = useState<StartMode>(getDefaultStartMode(lastEntryEndsAt));
    const [startCustomTime, setStartCustomTime] = useState<string>(getDefaultStartCustomTime(lastEntryEndsAt));
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
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    useEscapeKey(onExit, !saving);

    const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
        }
    }, []);

    const selectedMru = workMode === "mru" ? mostRecentlyUsed.find(item => mruKey(item) === selectedMruKey) : undefined;
    const selectedProjectId = workMode === "custom" ? customProjectId : (selectedMru ? selectedMru.project.msdyn_projectid : null);
    const selectedTaskId = workMode === "custom" ? customTaskId : (selectedMru ? selectedMru.task.msdyn_projecttaskid : null);

    const qualifierSuggestions = useMemo(() => {
        if (!selectedProjectId || !selectedTaskId) {
            return [];
        }
        const seen = new Set<string>();
        const suggestions: string[] = [];
        for (const usage of recentQualifierUsage) {
            if (usage.projectId !== selectedProjectId || usage.taskId !== selectedTaskId || !usage.qualifier || seen.has(usage.qualifier)) {
                continue;
            }
            seen.add(usage.qualifier);
            suggestions.push(usage.qualifier);
        }
        return suggestions;
    }, [recentQualifierUsage, selectedProjectId, selectedTaskId]);

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

    // Lets an undo redisplay a task once the project's task list (re)loads - changing the
    // project otherwise clears the selected task.
    const pendingTaskIdRef = useRef<string | null>(null);

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
        setCustomTaskId(pendingTaskIdRef.current);
        pendingTaskIdRef.current = null;
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

    // Custom times are always taken as today's date (as of when Record is pressed).
    const resolveStart = (): Date | null => {
        if (startMode === "lastEntry") {
            return lastEntryEndsAt;
        }
        if (startMode === "screenOpened") {
            return screenOpenedAvailable ? screenOpenedAt : null;
        }
        return fromTimeInputValue(startCustomTime, new Date());
    };

    const resolveEnd = (): Date => (endMode === "now" ? new Date() : fromTimeInputValue(endCustomTime, new Date()));

    // Takes the post-save/post-undo last entry explicitly, since the prop this render closed
    // over is stale while a save or undo is still in flight.
    const clearForm = (lastEnd: Date | null = lastEntryEndsAt) => {
        setStartMode(getDefaultStartMode(lastEnd));
        setStartCustomTime(getDefaultStartCustomTime(lastEnd));
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
        if (!startsAt) {
            setErrorMessage("Select a start time.");
            return;
        }
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
            entry = { startsAt, endsAt, isSplit: false, project: selected.project, task: selected.task, qualifier: selected.qualifier };
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
            // The day's last entry is now this one, or a later one recorded earlier.
            clearForm(lastEntryEndsAt && lastEntryEndsAt > endsAt ? lastEntryEndsAt : endsAt);
            setQualifier("");
            focusWorkModeRadio(defaultWorkMode);
            setSuccessMessage("Entry recorded.");
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
            successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), SUCCESS_BANNER_TIMEOUT_MS);
        } else {
            setErrorMessage(result.errorMessage ?? "Failed to save entry.");
        }
    };

    const handleUndo = async () => {
        setErrorMessage(null);
        setSaving(true);
        const result = await undoLastEntry();
        setSaving(false);
        if (!result.success || !result.undoneEntry) {
            setErrorMessage(result.errorMessage ?? "Failed to undo the last entry.");
            return;
        }
        const entry = result.undoneEntry;
        const lastEnd = result.lastEntryEndsAt ?? null;
        clearForm(lastEnd);

        if (lastEnd && lastEnd.getTime() === entry.startsAt.getTime()) {
            setStartMode("lastEntry");
        } else if (!lastEnd && screenOpenedToday && screenOpenedAt.getTime() === entry.startsAt.getTime()) {
            setStartMode("screenOpened");
        } else {
            setStartMode("custom");
            setStartCustomTime(toTimeInputValue(entry.startsAt));
        }
        setEndMode("custom");
        setEndCustomTime(toTimeInputValue(entry.endsAt));

        if (entry.isSplit) {
            setWorkMode("split");
        } else {
            const key = mruKey(entry);
            if (mostRecentlyUsed.some(item => mruKey(item) === key)) {
                setWorkMode("mru");
                setSelectedMruKey(key);
            } else {
                setWorkMode("custom");
                // Overrides clearForm()'s reset. If the project is unchanged the task-loading
                // effect won't re-run, so the task has to be set directly.
                setCustomProjectId(entry.project.msdyn_projectid);
                if (customProjectId === entry.project.msdyn_projectid) {
                    setCustomTaskId(entry.task.msdyn_projecttaskid);
                } else {
                    pendingTaskIdRef.current = entry.task.msdyn_projecttaskid;
                }
            }
            setQualifier(entry.qualifier);
        }
        setSuccessMessage("Last entry undone - it is shown below so you can amend and re-record it.");
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => setSuccessMessage(null), SUCCESS_BANNER_TIMEOUT_MS * 3);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleRecord();
    };

    return (
        <FullWidthContent>
        <VerticalContent>
        <form onSubmit={handleSubmit}>
            {successMessage && (
                <div className="mb-4 banner-success">
                    {successMessage}
                </div>
            )}
            {!screenOpenedToday && (
                <div className="mb-4 banner-error">
                    The date has changed since this screen was opened, so it has been refreshed for today.
                </div>
            )}
            <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="text-lg font-semibold text-ink">Record Time</h2>
                <span className="text-sm text-ink-soft">Recorded today: <span className="font-semibold text-ink">{formatDuration(totalMinutesToday)}</span></span>
            </div>
            <div className="mb-5">
                <h3 className="section-label mb-2">Time</h3>
                <div className="mb-3">
                    <h4 className="text-xs font-medium text-ink-soft mb-1">Start</h4>
                    <label className="radio-row">
                        <input type="radio" className="accent-primary" name="startMode" checked={startMode === "lastEntry"} disabled={!lastEntryEndsAt}
                            onChange={() => setStartMode("lastEntry")} />
                        End of last entry{lastEntryEndsAt ? ` (${toTimeInputValue(lastEntryEndsAt)})` : " (none yet)"}
                    </label>
                    <label className={`radio-row ${screenOpenedAvailable ? "" : "text-ink-soft"}`}>
                        <input type="radio" className="accent-primary" name="startMode" checked={startMode === "screenOpened"} disabled={!screenOpenedAvailable}
                            onChange={() => setStartMode("screenOpened")} />
                        Start of recording ({toTimeInputValue(screenOpenedAt)})
                    </label>
                    <label className="radio-row">
                        <input type="radio" className="accent-primary" name="startMode" checked={startMode === "custom"}
                            onChange={() => setStartMode("custom")} />
                        Custom
                        <input type="time" className="field w-auto" value={startCustomTime} disabled={startMode !== "custom"}
                            onChange={(e) => setStartCustomTime(e.target.value)} />
                    </label>
                </div>
                <div>
                    <h4 className="text-xs font-medium text-ink-soft mb-1">End</h4>
                    <label className="radio-row">
                        <input type="radio" className="accent-primary" name="endMode" checked={endMode === "now"}
                            onChange={() => setEndMode("now")} />
                        Now
                    </label>
                    <label className="radio-row">
                        <input type="radio" className="accent-primary" name="endMode" checked={endMode === "custom"}
                            onChange={() => setEndMode("custom")} />
                        Custom
                        <input type="time" className="field w-auto" value={endCustomTime} disabled={endMode !== "custom"}
                            onChange={(e) => setEndCustomTime(e.target.value)} />
                    </label>
                </div>
            </div>

            <div className="mb-5">
                <h3 className="section-label mb-2">Work</h3>
                <label className="radio-row">
                    <input type="radio" className="accent-primary" name="workMode" ref={splitRadioRef} checked={workMode === "split"}
                        onChange={() => setWorkMode("split")} />
                    Split (shared out across today's other entries when reviewed)
                </label>
                <label className="radio-row">
                    <input type="radio" className="accent-primary" name="workMode" ref={mruRadioRef} checked={workMode === "mru"} disabled={mostRecentlyUsed.length === 0}
                        onChange={() => setWorkMode("mru")} />
                    Recent
                </label>
                {workMode === "mru" && (
                    <table className="table-fluent ml-6 mb-3 w-[calc(100%-1.5rem)]">
                        <thead>
                            <tr>
                                <th className="w-8"></th>
                                <th>Project</th>
                                <th>Task</th>
                                <th>Qualifier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mostRecentlyUsed.map((item) => {
                                const key = mruKey(item);
                                const selectItem = () => { setSelectedMruKey(key); setQualifier(item.qualifier); };
                                return (
                                    <tr key={key} className={`cursor-pointer ${selectedMruKey === key ? "bg-highlight" : ""}`} onClick={selectItem}>
                                        <td>
                                            <input type="radio" className="accent-primary" name="mruEntry" checked={selectedMruKey === key} onChange={selectItem} />
                                        </td>
                                        <td>{item.project.msdyn_subject}</td>
                                        <td>{taskDisplayName(item.task)}</td>
                                        <td>{item.qualifier}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <label className="radio-row">
                    <input type="radio" className="accent-primary" name="workMode" ref={customRadioRef} checked={workMode === "custom"}
                        onChange={() => setWorkMode("custom")} />
                    Custom
                </label>
                {workMode === "custom" && (
                    <div className="ml-6 mb-2 max-w-md">
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
                                options={(tasks ?? []).map(t => ({ value: t.msdyn_projecttaskid, label: taskDisplayName(t) }))}
                                value={customTaskId}
                                onChange={setCustomTaskId}
                                placeholder={!customProjectId ? "Select a project first" : (tasks ? "Select a task..." : "Loading tasks...")}
                                disabled={!customProjectId || !tasks}
                                onReload={customProjectId ? reloadTasks : undefined}
                                reloading={tasksReloading} />
                        </div>
                    <QualifierInput
                        value={qualifier}
                        onChange={setQualifier}
                        suggestions={qualifierSuggestions}
                        placeholder="Qualifier (optional)" />
                    </div>
                )}
            </div>

            {errorMessage && <div className="banner-error mb-3">{errorMessage}</div>}

            <div className="flex gap-2 pt-3 border-t border-line">
                <button type="submit" className="btn-primary"
                    disabled={saving}>
                    Record
                </button>
                <button type="button" className="btn-secondary"
                    onClick={() => clearForm()} disabled={saving}>
                    Clear
                </button>
                <button type="button" className="btn-secondary"
                    onClick={handleUndo} disabled={saving || !lastEntryEndsAt}
                    title="Remove the last entry recorded today and show it again so it can be amended">
                    Undo
                </button>
                <button type="button" className="btn-secondary"
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
