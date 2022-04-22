import './InventoryItem.css';
import { useEffect, useRef } from "react";
import Conf from "../Config";
import { truncate } from '../utils/Utils';
import { Popover } from 'bootstrap';
import missing_thumbnail from '../img/missing_thumbnail.png';

type InventoryItemProps = {
    onSelect: (item_id: number) => void;
    onBurn: (item_id: number) => void;
    onTransfer: (item_id: number) => void;
    item_metadata: any;
}

export const InventoryItem: React.FC<InventoryItemProps> = (props) => {

    const item_data = props.item_metadata;
    const token_data = item_data.token;
    const item_metadata = token_data.item_metadata.metadata ? token_data.item_metadata.metadata : {};

    const name = item_metadata ? item_metadata.name : null;
    const description = item_metadata && item_metadata.description ? item_metadata.description : "None.";

    const popoverRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if(popoverRef.current) {
            const popover = new Popover(popoverRef.current, {
                content: "Description:\n\n" + description,
                placement: 'right',
                trigger: 'hover',
                customClass: "description-popover"
            });

            return () => {
                popover.dispose();
            }
        }

        return;
    })

    const getThumbnailUrl = (url: string | null): string => {
        if(url) return `${Conf.ipfs_gateway}/ipfs/${url.slice(7)}`;

        return missing_thumbnail;
    }

    return (
        <div className="card m-2 inventory-item" id={token_data.id} ref={popoverRef}>
            <div className='position-absolute' style={{zIndex: 1040, right: "0.5rem", top: "0.5rem" }}>
                <button className='btn btn-sm btn-outline-primary me-1' onClick={() => props.onTransfer(token_data.id)}><i className="bi bi-send-fill"></i></button>
                <button className='btn btn-sm btn-outline-danger' onClick={() => props.onBurn(token_data.id)}><i className="bi bi-trash-fill"></i></button>
            </div>

            <div onClick={() => props.onSelect(token_data.id)}>
                <img src={getThumbnailUrl(item_metadata.thumbnailUri)} className="card-img-top" alt="..."/>
                <div className="card-body">
                    <h5 className="card-title">{name ? truncate(name, 15, '\u2026') : <span className='text-danger'>Metadata missing</span>}</h5>
                    <p className="card-text">x{item_data.quantity}<small>/{token_data.supply}</small></p>
                    <small className="card-text"></small>
                    <p className="card-text small m-0">
                        Royalties: {token_data.royalties === 0 ? 0 : (token_data.royalties / 10).toFixed(2)}{"\u0025"}<br/>
                        Minter: </p>
                    <p className="card-text small text-muted">{truncate(token_data.minterId, 16, '\u2026')}</p>
                </div>
            </div>
        </div>
    );
}