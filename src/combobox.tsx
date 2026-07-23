import { useEffect, useRef, useState } from "react";

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
    const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Kept in sync with the selected option whenever the dropdown isn't actively being typed in,
    // so switching selection externally (e.g. clearing the project) updates the displayed text.
    useEffect(() => {
        if (!isOpen) {
            setSearchText(selectedOption?.label ?? "");
        }
    }, [selectedOption?.label, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchText(selectedOption?.label ?? "");
            }
        };
        window.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, selectedOption?.label]);

    const filteredOptions = isOpen
        ? options.filter((option) => option.label.toLowerCase().includes(searchText.toLowerCase()))
        : options;

    const openDropdown = () => {
        setIsOpen(true);
        setSearchText("");
        setHighlightedIndex(0);
    };

    const selectOption = (option: ComboBoxOption) => {
        onChange(option.value);
        setIsOpen(false);
        setSearchText(option.label);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape" && isOpen) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            setSearchText(selectedOption?.label ?? "");
            return;
        }
        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
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
        } else if (e.key === "Enter") {
            e.preventDefault();
            const option = filteredOptions[highlightedIndex];
            if (option) {
                selectOption(option);
            }
        }
    };

    return (
        <div className="flex gap-2">
            <div className="relative flex-1" ref={containerRef}>
                <input
                    type="text"
                    className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:text-gray-400"
                    value={searchText}
                    placeholder={placeholder ?? "Select..."}
                    disabled={disabled}
                    onFocus={openDropdown}
                    onChange={(e) => {
                        setIsOpen(true);
                        setSearchText(e.target.value);
                        setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                />
                {isOpen && (
                    <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border rounded shadow">
                        {filteredOptions.length === 0 ? (
                            <li className="px-2 py-1 text-gray-400">No matches</li>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <li
                                    key={option.value}
                                    className={`px-2 py-1 cursor-pointer ${index === highlightedIndex ? "bg-blue-500 text-white" : "hover:bg-gray-100"}`}
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
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 rounded px-2 disabled:bg-gray-100 disabled:text-gray-400"
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
