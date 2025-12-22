export interface EditingDayProps {
    date: string; // ISO date string
}

const EditingDay: React.FunctionComponent<EditingDayProps> = (props) => {
    return (
        <div>Editing Data for {props.date}</div>
    )
}
export default EditingDay;