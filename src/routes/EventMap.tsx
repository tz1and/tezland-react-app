import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import assert from 'assert';
import { grapphQLUser } from '../graphql/user';
import { ImageOverlay, MapContainer, Marker, Popup } from 'react-leaflet';
import { GetPlacesWithItemsByTagQuery } from '../graphql/generated/user';
import { getiFrameControl } from '../forms/DirectoryForm';
import { Button } from 'react-bootstrap';
import map from '../img/map.svg';
import './EventMap.css';

// gotta do this little dance to make sure the markers are displayed properly.
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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
    className: "map-event-marker"
});

type UserProps = {}

export const EventMap: React.FC<UserProps> = (props) => {
    const params = useParams();

    const [result, setResult] = useState<GetPlacesWithItemsByTagQuery>()

    assert(params.eventName);
    assert(params.eventLabel);
    const eventName = params.eventName;
    const eventLabel = params.eventLabel;

    useEffect(() => {
        if (!result) {
            grapphQLUser.getPlacesWithItemsByTag({tag: eventName, amount: 100, offset: 0}).then(res => {
                setResult(res);
            });
        }
    }, [result, eventName])

    const handleClick = (location: string) => {
        const iFrameControl = getiFrameControl(window);
        assert(iFrameControl);
        iFrameControl.teleportToLocation(location);
        iFrameControl.closeForm(false);
    }

    const markers: JSX.Element[] = [];
    if (result) {
        result.placeToken.forEach((p) => {
            const coords: number[] = JSON.parse(p.metadata!.centerCoordinates);
            markers.push(
                <Marker position={[1000 - coords[2], 1000 - coords[0]]} icon={altIcon} key={`place${p.id}`}>
                    <Popup className='fs-6'>
                        <p>Place #{p.id}</p>
                        <Button onClick={() => handleClick(`place${p.id}`)}>Teleport Here</Button>
                    </Popup>
                </Marker>
            )
        })
    }

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>{eventLabel}</h1>
                <h5>All Places participating in this event.</h5>
            </div>

            <MapContainer center={[1000, 1000]} minZoom={-1} zoom={2} scrollWheelZoom={true} crs={L.CRS.Simple} style={{ height: "70vh", backgroundColor: 'white' }}>
                <ImageOverlay bounds={[[0,0], [2000, 2000]]} url={map} />
                {markers}
            </MapContainer>
        </main>
    );
}
