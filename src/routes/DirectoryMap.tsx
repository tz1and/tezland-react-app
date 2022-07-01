import InteractiveMap from '../components/InteractiveMap';
import { MarkerMode } from '../world/WorldMap';


export const DirectoryMap: React.FC<{}> = (props) => {
    return (
        <main>
            <InteractiveMap zoom={500} threeD={true} markerMode={MarkerMode.SpawnsAndTeleporters} />
        </main>
    );
}