//import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, ImageOverlay, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css';

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
                <MapContainer center={[500, 500]} minZoom={-1} zoom={1} scrollWheelZoom={false} crs={L.CRS.Simple} style={{ height: "80vh", backgroundColor: 'white' }}>
                    <ImageOverlay bounds={[[0,0], [1000, 1000]]} url="/img/map.svg" />
                    {/*<Marker position={[500, 500]}>
                        <Popup>
                            A pretty CSS3 popup. <br /> Easily customizable.
                        </Popup>
                    </Marker>
                    <Circle center={[500, 500]} radius={5} />*/}
                </MapContainer>
            </div>

        </main>
    );
}