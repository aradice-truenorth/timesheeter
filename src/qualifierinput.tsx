import { useEffect, useRef, useState } from "react";

export interface QualifierInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    disabled?: boolean;
}

// A free-text input with an autocomplete dropdown: unlike ComboBox, the typed text IS the value -
// suggestions are offered but never required, so users can enter a qualifier that's never been used before.
const QualifierInput: React.FunctionComponent<QualifierInputProps> = (props) => {
    const { value, onChange, suggestions, placeholder, disabled } = props;

    const [isOpen, setIsOpen] = useState<boolean>(false);
    // -1 means no suggestion is explicitly highlighted yet - Enter only accepts a suggestion once
    // the user has actually pressed ArrowDown/ArrowUp (or hovered), so an unmodified Enter falls
    // through to the surrounding form instead of silently substituting the top match.
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredSuggestions = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(value.toLowerCase()));

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        window.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const selectSuggestion = (suggestion: string) => {
        onChange(suggestion);
        setIsOpen(false);
    };

    // Enter only ever intercepts to pick an explicitly-highlighted suggestion (one reached via
    // ArrowDown/ArrowUp or a mouse hover); with the dropdown closed, or open but nothing
    // highlighted yet, it falls through so Enter still submits the form like a plain text field did.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape" && isOpen) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            return;
        }
        if (!isOpen) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex(0);
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((current) => Math.min(current + 1, filteredSuggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
        } else if (e.key === "Enter" && highlightedIndex >= 0) {
            const suggestion = filteredSuggestions[highlightedIndex];
            if (suggestion) {
                e.preventDefault();
                selectSuggestion(suggestion);
            }
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <input
                type="text"
                className="field w-full mt-1"
                placeholder={placeholder ?? "Qualifier (optional)"}
                value={value}
                disabled={disabled}
                onChange={(e) => {
                    onChange(e.target.value);
                    setIsOpen(true);
                    setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
            />
            {isOpen && filteredSuggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-surface border border-line-strong rounded-sm shadow-md text-sm">
                    {filteredSuggestions.map((suggestion, index) => (
                        <li
                            key={suggestion}
                            className={`px-2.5 py-1.5 cursor-pointer ${index === highlightedIndex ? "bg-primary text-white" : "hover:bg-highlight"}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                selectSuggestion(suggestion);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
export default QualifierInput;
