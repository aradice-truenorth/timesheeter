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
}

const ComboBox: React.FunctionComponent<ComboBoxProps> = (props) => {
    const { options, value, onChange, placeholder, disabled } = props;
    return (
        <select
            className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:text-gray-400"
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        >
            <option value="" disabled>{placeholder ?? "Select..."}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    );
};
export default ComboBox;
