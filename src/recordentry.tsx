import { RecordedTimeEntry } from "./services/recordeddataservice";
import VerticalContent from "./verticalcontent";

export interface SaveEntryResult {
    success: boolean;
    errorMessage?: string;
}

export interface RecordEntryProps {
    defaultStartsAt: Date | null;
    saveEntry: (entry: RecordedTimeEntry) => Promise<SaveEntryResult>;
}


const RecordEntry: React.FunctionComponent<RecordEntryProps> = (props) => {
    return (
        <VerticalContent>
            <></>
            <></>
        </VerticalContent>
    )
}
export default RecordEntry;