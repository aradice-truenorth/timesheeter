export interface ComboBoxProps {
    date: string; // ISO date string
}

const ComboBox: React.FunctionComponent<ComboBoxProps> = (props) => {
    return (
        <div>Editing Data for {props.date}</div>
    )
}
export default ComboBox;