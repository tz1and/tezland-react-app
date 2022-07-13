import { Helmet } from 'react-helmet-async';
import InteractiveMap from '../components/InteractiveMap';
import { MarkerMode } from '../world/WorldMap';


export const Map: React.FC<{}> = (props) => {
    return (
        <main>
            <Helmet>
                <title>tz1and - Map</title>
            </Helmet>
            <div className="container text-start pt-4">
                <h1>World Map</h1>
            </div>
            <div className='container-fluid p-0'>
                <InteractiveMap zoom={500} threeD={true} markerMode={MarkerMode.SpawnsAndTeleporters} />
            </div>
        </main>
    );
}