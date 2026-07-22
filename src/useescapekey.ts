import { useEffect } from "react";

// Attaches (and detaches) a window-level Escape listener only while enabled, so callers can
// scope it to whichever sub-view is actually showing an Exit button without violating the
// rules of hooks (it must still be called unconditionally on every render).
export const useEscapeKey = (onEscape: () => void, enabled = true): void => {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onEscape();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onEscape, enabled]);
};
