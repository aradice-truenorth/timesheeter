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
            return <EditingDaysList />;
        default:
            return (
                <VerticalContent>
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded block mb-20" onClick={() => setHomeScreenState(HomeScreenState.Recording)}>
                        Record Time
                    </button>
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded block" onClick={() => setHomeScreenState(HomeScreenState.Editing)}>
                        Edit and Upload Entries
                    </button>
                </VerticalContent>
            );
    }
};

export default Home;