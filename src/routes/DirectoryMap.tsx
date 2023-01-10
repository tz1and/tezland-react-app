import React from 'react';
import { getDirectoryEnabledGlobal } from '../forms/DirectoryForm';
import { MarkerMode } from '../world/map/WorldMap';
import InteractiveMap from '../components/InteractiveMap';
import assert from 'assert';


const DirectoryMap: React.FC<{}> = (props) => {
    const directoryState = getDirectoryEnabledGlobal();
    assert(directoryState)

    return (
        <main>
            <InteractiveMap zoom={500} threeD={true} markerMode={MarkerMode.SpawnsAndTeleporters} location={directoryState.coords} />
        </main>
    );
}

export default DirectoryMap;