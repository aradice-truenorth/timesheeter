import { useEffect, useState } from "react";

export interface ComboBoxOption {
    value: string;
    label: string;
}

export interface ComboBoxProps {
    options: ComboBoxOption[];
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    onReload?: () => void;
    reloading?: boolean;
}

const ComboBox: React.FunctionComponent<ComboBoxProps> = (props) => {
    const { options, value, onChange, placeholder, disabled, onReload, reloading } = props;
    const selectedOption = options.find((option) => option.value === value) ?? null;

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>("");
    // -1 means no option is explicitly highlighted yet - Enter only selects an option once the
    // user has actually pressed ArrowDown/ArrowUp (or hovered), so an unmodified Enter falls
    // through to the surrounding form instead of hijacking it.
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    // Kept in sync with the selected option whenever the dropdown isn't actively being typed in,
    // so switching selection externally (e.g. clearing the project) updates the displayed text.
    useEffect(() => {
        if (!isOpen) {
            setSearchText(selectedOption?.label ?? "");
        }
    }, [selectedOption?.label, isOpen]);

    const filteredOptions = isOpen
        ? options.filter((option) => option.label.toLowerCase().includes(searchText.toLowerCase()))
        : options;

    // Once a value is selected the field is locked: it can't be typed over or re-searched, only
    // cleared with Backspace/Delete, and focusing it (e.g. tabbing back in) leaves it alone.
    const isLocked = selectedOption !== null;

    const openDropdown = () => {
        if (isLocked) {
            return;
        }
        setIsOpen(true);
        setSearchText("");
        setHighlightedIndex(-1);
    };

    const selectOption = (option: ComboBoxOption) => {
        onChange(option.value);
        setIsOpen(false);
        setSearchText(option.label);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isLocked) {
            if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                onChange(null);
                setSearchText("");
                setIsOpen(true);
                setHighlightedIndex(-1);
            }
            return;
        }
        if (e.key === "Escape" && isOpen) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            // Nothing is selected here (a selected field is locked and handled above).
            setSearchText("");
            return;
        }
        if (!isOpen) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                openDropdown();
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
        } else if (e.key === "Enter" && highlightedIndex >= 0) {
            e.preventDefault();
            const option = filteredOptions[highlightedIndex];
            if (option) {
                selectOption(option);
            }
        }
    };

    return (
        <div className="flex gap-2">
            <div className="relative flex-1">
                <input
                    type="text"
                    className={`field w-full ${isLocked ? "cursor-default" : ""}`}
                    value={searchText}
                    placeholder={placeholder ?? "Select..."}
                    disabled={disabled}
                    readOnly={isLocked}
                    title={isLocked ? "Press Backspace or Delete to clear" : undefined}
                    onFocus={openDropdown}
                    onBlur={() => {
                        setIsOpen(false);
                        setSearchText(selectedOption?.label ?? "");
                    }}
                    onChange={(e) => {
                        setIsOpen(true);
                        setSearchText(e.target.value);
                        setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                />
                {isOpen && (
                    <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-surface border border-line-strong rounded-sm shadow-md text-sm"
                        onMouseDown={(e) => e.preventDefault() /* keep focus in the input, e.g. when dragging the scrollbar */}>
                        {filteredOptions.length === 0 ? (
                            <li className="px-2.5 py-1.5 text-ink-soft">No matches</li>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <li
                                    key={option.value}
                                    className={`px-2.5 py-1.5 cursor-pointer ${index === highlightedIndex ? "bg-primary text-white" : "hover:bg-highlight"}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectOption(option);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                >
                                    {option.label}
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
            {onReload && (
                <button
                    type="button"
                    title="Reload from Dynamics"
                    className="btn-secondary"
                    onClick={onReload}
                    disabled={disabled || reloading}
                >
                    {reloading ? "Reloading..." : "Reload"}
                </button>
            )}
        </div>
    );
};
export default ComboBox;
