import './InventoryItem.css';
import { truncate } from '../utils/Utils';
import map from '../img/map.svg';
import L from 'leaflet';
import { Circle, ImageOverlay, MapContainer, Polygon } from 'react-leaflet';
import './PlaceItem.css'

type PlaceItemProps = {
    onSelect: (item_id: number) => void;
    onTransfer?: ((item_id: number) => void) | undefined;
    item_metadata: any;
}

export const PlaceItem: React.FC<PlaceItemProps> = (props) => {

    const item_data = props.item_metadata;
    const token_data = item_data.token;
    const place_metadata = token_data.place_metadata.metadata ? token_data.place_metadata.metadata : {};

    const name = place_metadata ? place_metadata.name : null;
    const description = place_metadata && place_metadata.description ? place_metadata.description : "None.";

    // TODO: put this in state maybe?
    const coords = place_metadata.centerCoordinates;
    const center_pos: [number, number] = [1000 + -coords[2], 1000 + -coords[0]];

    const polygon = place_metadata.borderCoordinates;
    const placePoly: [number, number][] = [];
    for(const pos of polygon) {
        placePoly.push([center_pos[0] + -pos[2], center_pos[1] + -pos[0]]);
    }

    return (
        <div className="card m-2 inventory-item" id={token_data.id}>
            <div className='position-absolute' style={{zIndex: 1010, right: "0.5rem", top: "0.5rem" }}>
                { props.onTransfer && <button className='btn btn-sm btn-primary me-1' onClick={() => props.onTransfer && props.onTransfer(token_data.id)}><i className="bi bi-send-fill"></i></button> }
            </div>

            <div onClick={() => props.onSelect(token_data.id)}>
                <MapContainer className="card-img-top place-item-map" center={center_pos} zoom={1} minZoom={-2} maxZoom={2} attributionControl={false} dragging={false} zoomControl={true} scrollWheelZoom={false} crs={L.CRS.Simple}>
                    <ImageOverlay bounds={[[0, 0], [2000, 2000]]} url={map} />
                    <Circle center={center_pos} radius={1.5} color='#d58195' fillColor='#d58195' fill={true} fillOpacity={1} />
                    <Polygon positions={placePoly} color='#d58195' weight={10} lineCap='square'/>
                </MapContainer>
                <div className="card-body">
                    <h5 className="card-title">{name ? truncate(name, 15, '\u2026') : <span className='text-danger'>Metadata missing</span>}</h5>
                    <p className="card-text">{description}</p>
                </div>
            </div>
        </div>
    );
}