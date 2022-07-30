import React from 'react';
import { Helmet } from 'react-helmet-async';
import { MarkerMode } from '../world/map/WorldMap';


const InteractiveMap = React.lazy(() => import('../components/InteractiveMap'));

const Map: React.FC<{}> = () => {
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

export default Map;