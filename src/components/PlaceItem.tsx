import './InventoryItem.css';
import { truncate } from '../utils/Utils';
import './PlaceItem.css'
import { useEffect, useState } from 'react';
import Metadata, { PlaceTokenMetadata } from '../world/Metadata';
import { FetchDataPlaceToken, FetchDataResult, ItemClickedFunc } from './TokenInfiniteScroll';
import TokenKey from '../utils/TokenKey';
import { getPlaceType, PlaceType } from "../utils/PlaceKey";
import { WorldMap2D } from './WorldMap2D';


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

    const placeType = getPlaceType(token_key.fa2);

    return (
        <div className="card m-2 inventory-item" id={props.item_metadata.token.tokenId.toString()}>
            <div className='position-absolute' style={{zIndex: 1010, right: "0.5rem", top: "0.5rem" }}>
                { props.onTransfer && <button className='btn btn-sm btn-primary me-1' onClick={() => props.onTransfer && props.onTransfer(props.item_metadata.token.tokenId)}><i className="bi bi-send-fill"></i></button> }
            </div>

            <div onClick={() => props.onSelect(token_key)}>
                <WorldMap2D mapClass='card-img-top place-item-map' isExteriorPlace={placeType !== PlaceType.Interior} style={{}} location={center_pos} placePoly={placePoly} zoom={1} zoomControl={true} animate={false} />
                <div className="card-body">
                    <h5 className="card-title">{name ? truncate(name, 15, '\u2026') : <span className='text-danger'>Metadata missing</span>}</h5>
                    <p className="card-text">{description}</p>
                </div>
            </div>
        </div>
    );
}