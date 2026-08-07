import { useState } from "react";
import Recording from "./recording";
import EditingDaysList from "./editingdayslist";
import VerticalContent from "./verticalcontent";

enum HomeScreenState {
    Home,
    Recording,
    Editing
}

const Home = () => {
    const [homeScreenState, setHomeScreenState ] = useState<HomeScreenState>(HomeScreenState.Home)

    switch (homeScreenState) {
        case HomeScreenState.Recording:
            return <Recording onExit={() => setHomeScreenState(HomeScreenState.Home)} />
        case HomeScreenState.Editing:
            return <EditingDaysList onExit={() => setHomeScreenState(HomeScreenState.Home)} />;
        default:
            return (
                <VerticalContent>
                    <h2 className="text-lg font-semibold text-ink mb-4">Timesheeter</h2>
                    <div className="flex flex-row gap-2">
                        <button className="btn-primary w-fit" onClick={() => setHomeScreenState(HomeScreenState.Recording)}>
                            Record Time
                        </button>
                        <button className="btn-secondary w-fit" onClick={() => setHomeScreenState(HomeScreenState.Editing)}>
                            Edit and Upload Entries
                        </button>
                    </div>
                </VerticalContent>
            );
    }
};

export default Home;