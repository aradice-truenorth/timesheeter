import { useEffect } from "react";

// Window-level Ctrl+Z (or Cmd+Z on macOS). The browser's own undo is suppressed whenever this is
// mounted - even while focus is in a text field, and even while onUndo isn't currently available -
// so the shortcut always means the same thing on the screen rather than sometimes undoing typing.
// Ctrl+Shift+Z (redo) is left alone, and held-down auto-repeat is ignored so one press undoes once.
export const useUndoKey = (onUndo: () => void, enabled = true): void => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") {
                return;
            }
            e.preventDefault();
            if (enabled && !e.repeat) {
                onUndo();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onUndo, enabled]);
};
