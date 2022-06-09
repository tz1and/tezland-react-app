import './InventoryItem.css';
import Conf from "../Config";
import { numberWithSign, truncate, truncateAddress } from '../utils/Utils';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import missing_thumbnail from '../img/missing_thumbnail.png';
import ItemTracker from '../controllers/ItemTracker';

type InventoryItemProps = {
    onSelect: (item_id: number, quantity: number) => void;
    onBurn?: ((item_id: number) => void) | undefined;
    onTransfer?: ((item_id: number) => void) | undefined;
    item_metadata: any;
    trackItems?: boolean;
    isTempItem?: boolean;
}

export const InventoryItem: React.FC<InventoryItemProps> = (props) => {

    const item_data = props.item_metadata;
    const token_data = item_data.token;
    const item_metadata = token_data.item_metadata.metadata ? token_data.item_metadata.metadata : {};

    const name = item_metadata ? item_metadata.name : null;
    const description = item_metadata && item_metadata.description ? item_metadata.description : "None.";

    const getThumbnailUrl = (url: string | null): string => {
        if(url) return `${Conf.ipfs_gateways[0]}/ipfs/${url.slice(7)}`;

        return missing_thumbnail;
    }

    let itemTrackedBalance = "";
    let balanceColor = "";
    if (props.trackItems) {
        const trackedItemBalance = -ItemTracker.getTempItemTrack(token_data.id);
        if (trackedItemBalance !== 0) itemTrackedBalance = `(${numberWithSign(trackedItemBalance)})`;

        if (props.isTempItem) balanceColor = "bg-success-light";

        const totalItemBalance = trackedItemBalance + item_data.quantity;
        if (totalItemBalance < 0) balanceColor = "bg-danger-light";
        else if (totalItemBalance === 0) balanceColor = "bg-warning-light";
    }

    return (
        <OverlayTrigger
            placement={"right"}
            overlay={
                <Popover className='description-popover'>
                    <Popover.Header as="h3">{name ? name : <span className='text-danger'>Metadata missing</span>}</Popover.Header>
                    <Popover.Body>
                        {description}
                    </Popover.Body>
                </Popover>
            }
        >
            <div className={`card m-2 inventory-item ${balanceColor}`} id={token_data.id}>
                <div className='position-absolute' style={{zIndex: 1010, right: "0.5rem", top: "0.5rem" }}>
                    { props.onTransfer && <button className='btn btn-sm btn-primary me-1' onClick={() => props.onTransfer && props.onTransfer(token_data.id)}><i className="bi bi-send-fill"></i></button> }
                    { props.onBurn && <button className='btn btn-sm btn-danger' onClick={() => props.onBurn && props.onBurn(token_data.id)}><i className="bi bi-trash-fill"></i></button> }
                </div>

                <div onClick={() => props.onSelect(token_data.id, item_data.quantity)}>
                    <img src={getThumbnailUrl(item_metadata.thumbnailUri)} className="card-img-top" alt="..."/>
                    <div className="card-body">
                        <h5 className="card-title">{name ? truncate(name, 15, '\u2026') : <span className='text-danger'>Metadata missing</span>}</h5>
                        <p className="card-text">x{item_data.quantity}{itemTrackedBalance}<small>/{token_data.supply}</small></p>
                        <small className="card-text"></small>
                        <p className="card-text small m-0">
                            Royalties: {token_data.royalties === 0 ? 0 : (token_data.royalties / 10).toFixed(2)}{"\u0025"}<br/>
                            Minter: </p>
                        <p className="card-text small text-muted">{truncateAddress(token_data.minterId)}</p>
                    </div>
                </div>
            </div>
        </OverlayTrigger>
        
    );
}