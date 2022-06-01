//import { Link } from 'react-router-dom';
import { MapContainer, ImageOverlay } from 'react-leaflet'
import 'leaflet/dist/leaflet.css';
import map from '../img/map.svg';

// gotta do this little dance to make sure the markers are displayed properly.
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

L.Marker.prototype.options.icon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow
});

export default function Map() {
    return (
        <main>
            <div className="container text-start pt-4">
                <h1>World Map</h1>
                <MapContainer center={[1000, 1000]} minZoom={-1} zoom={2} scrollWheelZoom={false} crs={L.CRS.Simple} style={{ height: "80vh", backgroundColor: 'white' }}>
                    <ImageOverlay bounds={[[0,0], [2000, 2000]]} url={map} />
                    {/*<Marker position={[1000, 1000]}>
                        <Popup>
                            A pretty CSS3 popup. <br /> Easily customizable.
                        </Popup>
                    </Marker>
                    <Circle center={[1000, 1000]} radius={5} />*/}
                </MapContainer>
            </div>

        </main>
    );
}