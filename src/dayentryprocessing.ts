import { Project, ProjectTask } from "./services/projectservice";
import { RecordedTimeEntry, SplitTimeEntry, WorkTimeEntry } from "./services/recordeddataservice";

export interface ProcessedDayEntry {
    project: Project;
    task: ProjectTask;
    qualifier: string;
    minutes: number;
}

const ROUNDING_INCREMENT_MINUTES = 15;
const MS_PER_MINUTE = 60000;

const durationMinutes = (entry: RecordedTimeEntry): number => (entry.endsAt.getTime() - entry.startsAt.getTime()) / MS_PER_MINUTE;

const roundToIncrement = (minutes: number): number => Math.round(minutes / ROUNDING_INCREMENT_MINUTES) * ROUNDING_INCREMENT_MINUTES;

const groupKey = (project: Project, task: ProjectTask, qualifier: string): string =>
    `${project.msdyn_projectid}|${task.msdyn_projecttaskid}|${qualifier}`;

// Groups same-project/task/qualifier entries, spreads "split" time proportionally across the
// resulting groups, rounds each to the nearest 15 minutes, then nudges the largest groups by
// +/-15 minutes (largest first) until the total matches the day's rounded total.
export const processDayEntries = (entries: RecordedTimeEntry[]): ProcessedDayEntry[] => {
    const workEntries = entries.filter((entry): entry is WorkTimeEntry => !entry.isSplit);
    const splitEntries = entries.filter((entry): entry is SplitTimeEntry => entry.isSplit);

    const groups = new Map<string, ProcessedDayEntry>();
    for (const entry of workEntries) {
        const key = groupKey(entry.project, entry.task, entry.qualifier);
        const minutes = durationMinutes(entry);
        const existing = groups.get(key);
        if (existing) {
            existing.minutes += minutes;
        } else {
            groups.set(key, { project: entry.project, task: entry.task, qualifier: entry.qualifier, minutes });
        }
    }

    const rows = Array.from(groups.values());
    const totalWorkMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
    const totalSplitMinutes = splitEntries.reduce((sum, entry) => sum + durationMinutes(entry), 0);

    if (totalSplitMinutes > 0 && totalWorkMinutes > 0) {
        rows.forEach((row) => {
            row.minutes += totalSplitMinutes * (row.minutes / totalWorkMinutes);
        });
    }

    rows.forEach((row) => {
        row.minutes = roundToIncrement(row.minutes);
    });

    const targetTotal = roundToIncrement(totalWorkMinutes + totalSplitMinutes);
    let diff = targetTotal - rows.reduce((sum, row) => sum + row.minutes, 0);

    const byDescendingSize = rows.slice().sort((a, b) => b.minutes - a.minutes);
    let safety = byDescendingSize.length * 1000;
    while (diff !== 0 && byDescendingSize.length > 0 && safety > 0) {
        for (const row of byDescendingSize) {
            if (diff === 0) {
                break;
            }
            if (diff > 0) {
                row.minutes += ROUNDING_INCREMENT_MINUTES;
                diff -= ROUNDING_INCREMENT_MINUTES;
            } else if (row.minutes >= ROUNDING_INCREMENT_MINUTES) {
                row.minutes -= ROUNDING_INCREMENT_MINUTES;
                diff += ROUNDING_INCREMENT_MINUTES;
            }
            safety--;
        }
    }

    return rows;
};
