//import { Link } from 'react-router-dom';
import { MapContainer, ImageOverlay, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css';
import map from '../img/map.svg';
import './DirectoryMap.css';

// gotta do this little dance to make sure the markers are displayed properly.
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { Button } from 'react-bootstrap';

import { WorldDefinition } from "../worldgen/WorldGen";
import world_definition from "../models/districts.json";
import { getiFrameControl } from '../forms/DirectoryForm';
import assert from 'assert';
Object.setPrototypeOf(world_definition, WorldDefinition.prototype);

L.Marker.prototype.options.icon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [13, 40]
});

const altIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [13, 40],
    className: "map-spawn-marker"
});

export default function DirectoryMap() {

    const teleportToMapLocation = (pos: [number, number]) => {
        const iFrameControl = getiFrameControl(window);
        assert(iFrameControl);
        iFrameControl.teleportToWorldPos(pos);
        iFrameControl.closeForm(false);
    }

    const markers: JSX.Element[] = [];
    for (const [districtIndex, d] of world_definition.districts.entries()) {
        for (const [boothIndex, b] of d.teleportation_booths.entries()) {
            const boothPos: [number, number] = [b.x + d.center.x, b.y + d.center.y]
            markers.push(
                <Marker position={[1000 - boothPos[1], 1000 - boothPos[0]]} key={`boothD${districtIndex + 1}-${boothIndex}`}>
                    <Popup className='fs-6'>
                        <p>A teleporter booth.</p>
                        <Button onClick={() => teleportToMapLocation(boothPos)}>Teleport Here</Button>
                    </Popup>
                </Marker>
            )
        }

        const spawnPos: [number, number] = [d.spawn.x + d.center.x, d.spawn.y + d.center.y]
        markers.push(
            <Marker position={[1000 - spawnPos[1], 1000 - spawnPos[0]]} icon={altIcon} key={`spawnD${districtIndex + 1}`}>
                <Popup className='fs-6'>
                    <p>A district spawn.</p>
                    <Button onClick={() => teleportToMapLocation(spawnPos)}>Teleport Here</Button>
                </Popup>
            </Marker>
        )
    }

    return (
        <main>
            <div className="text-start">
                <MapContainer center={[1000, 1000]} minZoom={-1} zoom={2} scrollWheelZoom={true} crs={L.CRS.Simple} style={{ height: "90vh", backgroundColor: 'white' }}>
                    <ImageOverlay bounds={[[0,0], [2000, 2000]]} url={map} />
                    {markers}
                </MapContainer>
            </div>

        </main>
    );
}