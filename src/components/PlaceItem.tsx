// eslint-disable-next-line import/no-webpack-loader-syntax
import map from "!file-loader!../img/map.svg"; // Temp workaround for CRA5

import './InventoryItem.css';
import { truncate } from '../utils/Utils';
import L from 'leaflet';
import { Circle, ImageOverlay, MapContainer, Polygon } from 'react-leaflet';
import './PlaceItem.css'
import { useEffect, useState } from 'react';
import Metadata, { PlaceTokenMetadata } from '../world/Metadata';
import { MapSetCenter } from '../forms/CreateAuction';
import { FetchDataPlaceToken, FetchDataResult, ItemClickedFunc } from './TokenInfiniteScroll';
import TokenKey from '../utils/TokenKey';


type PlaceItemProps = {
    onSelect: ItemClickedFunc;
    onTransfer?: ((item_id: number) => void) | undefined;
    item_metadata: FetchDataResult<FetchDataPlaceToken>;
}

export const PlaceItem: React.FC<PlaceItemProps> = (props) => {

    const [metadata, setMetadata] = useState<PlaceTokenMetadata>();

    useEffect(() => {
        if(!metadata)
            Metadata.getPlaceMetadata(props.item_metadata.token.tokenId, props.item_metadata.token.contractId).then((res) => {
                setMetadata(res)
            });
    }, [metadata, props.item_metadata.token.tokenId, props.item_metadata.token.contractId]);

    let name = null;
    let description = "None.";

    // TODO: put this in state maybe?
    let center_pos: [number, number] = [1000, 1000];
    let placePoly: [number, number][] = [];
    if (metadata) {
        name = metadata.name;
        if (metadata.description) description = metadata.description;

        const coords = metadata.centerCoordinates;
        center_pos = [1000 + -coords[2], 1000 + -coords[0]];

        const polygon = metadata.borderCoordinates;
        for(const pos of polygon) {
            placePoly.push([center_pos[0] + -pos[2], center_pos[1] + -pos[0]]);
        }
    }

    // TODO: use PlaceKey
    const token_key = TokenKey.fromNumber(props.item_metadata.token.tokenId, props.item_metadata.token.contractId);

    return (
        <div className="card m-2 inventory-item" id={props.item_metadata.token.tokenId.toString()}>
            <div className='position-absolute' style={{zIndex: 1010, right: "0.5rem", top: "0.5rem" }}>
                { props.onTransfer && <button className='btn btn-sm btn-primary me-1' onClick={() => props.onTransfer && props.onTransfer(props.item_metadata.token.tokenId)}><i className="bi bi-send-fill"></i></button> }
            </div>

            <div onClick={() => props.onSelect(token_key)}>
                <MapContainer className="card-img-top place-item-map" center={center_pos} zoom={1} minZoom={-2} maxZoom={2} attributionControl={false} dragging={false} zoomControl={true} scrollWheelZoom={false} crs={L.CRS.Simple}>
                    <MapSetCenter center={center_pos} animate={false}/>
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