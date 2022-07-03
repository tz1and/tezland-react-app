import InteractiveMap from '../components/InteractiveMap';
import { getDirectoryEnabledGlobal } from '../forms/DirectoryForm';
import { MarkerMode } from '../world/WorldMap';
import assert from 'assert';


export const DirectoryMap: React.FC<{}> = (props) => {
    const directoryState = getDirectoryEnabledGlobal();
    assert(directoryState)

    return (
        <main>
            <InteractiveMap zoom={500} threeD={true} markerMode={MarkerMode.SpawnsAndTeleporters} location={directoryState.coords} />
        </main>
    );
}