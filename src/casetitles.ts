import { ProjectTask } from "./services/projectservice";

// Support-call tasks are named "<case number>" or "<case number> / <tn_externalreference>",
// e.g. "CAS-01234-A1B2C3 / ABC-123" - the case number is always the leading token.
const CASE_NUMBER_PATTERN = /^CAS-[^\s/]+/i;

// Normalised to upper case, which is also how case titles are keyed.
export const extractCaseNumber = (taskSubject: string): string | null => {
    const match = CASE_NUMBER_PATTERN.exec(taskSubject.trim());
    return match ? match[0].toUpperCase() : null;
};

// Display only - the case title is never uploaded, only the task's ID is.
export const taskDisplayName = (task: ProjectTask): string =>
    task.caseTitle ? `${task.msdyn_subject} – ${task.caseTitle}` : task.msdyn_subject;

// Distinct case numbers of the support-call tasks among these.
export const caseNumbersOf = (tasks: ProjectTask[]): string[] => {
    const numbers = new Set<string>();
    for (const task of tasks) {
        const caseNumber = extractCaseNumber(task.msdyn_subject);
        if (caseNumber) {
            numbers.add(caseNumber);
        }
    }
    return Array.from(numbers);
};

// Case numbers of support-call tasks that don't have a title yet (e.g. entries recorded before
// titles were captured).
export const caseNumbersMissingTitles = (tasks: ProjectTask[]): string[] =>
    caseNumbersOf(tasks.filter(task => !task.caseTitle));

export const withCaseTitle = (task: ProjectTask, caseTitles: Record<string, string>): ProjectTask => {
    if (task.caseTitle) {
        return task;
    }
    const caseNumber = extractCaseNumber(task.msdyn_subject);
    const caseTitle = caseNumber ? caseTitles[caseNumber] : undefined;
    return caseTitle ? { ...task, caseTitle } : task;
};

// Renderer only. For entries recorded before case titles were captured - looked up after the screen has
// loaded, so a slow or failed lookup never holds it up.
export const fillInCaseTitles = async (tasks: ProjectTask[]): Promise<Record<string, string>> => {
    const caseNumbers = caseNumbersMissingTitles(tasks);
    return caseNumbers.length > 0 ? window.mainProcess.getCaseTitles(caseNumbers) : {};
};
