import './InventoryItem.css';
import { useEffect, useRef } from "react";
import Conf from "../Config";
import { truncate } from '../utils/Utils';
import { Popover } from 'bootstrap';

type InventoryItemProps = {
    onSelect: (item_id: number) => void;
    onBurn: (item_id: number) => void;
    item_metadata: any;
}

export const InventoryItem: React.FC<InventoryItemProps> = (props) => {

    const popoverRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if(popoverRef.current) {
            const popover = new Popover(popoverRef.current, {
                content: "Description:\n\n" + (props.item_metadata.token.description ? props.item_metadata.token.description : "None."),
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

    const getThumbnailUrl = (url: string | undefined): string => {
        if(url) return `${Conf.ipfs_gateway}/ipfs/${url.slice(7)}`;

        return "/img/missing_thumbnail.png";
    }

    const item_metadata = props.item_metadata;

    return (
        <div className="card m-2 inventory-item" id={item_metadata.token.id} ref={popoverRef}>
            <button className='btn btn-sm btn-outline-danger position-absolute' style={{zIndex: 1040, right: "0.5rem", top: "0.5rem" }} onClick={() => props.onBurn(item_metadata.token.id)}><i className="bi bi-trash-fill"></i></button>

            <div onClick={() => props.onSelect(item_metadata.token.id)}>
                <img src={getThumbnailUrl(item_metadata.token.thumbnailUri)} className="card-img-top" alt="..."/>
                <div className="card-body">
                    <h5 className="card-title">{item_metadata.token.name !== "" ? truncate(item_metadata.token.name, 15, '\u2026') : <span className='text-danger'>Metadata missing</span>}</h5>
                    <p className="card-text">x{item_metadata.quantity}<small>/{item_metadata.token.supply}</small></p>
                    <small className="card-text"></small>
                    <p className="card-text small m-0">
                        Royalties: {item_metadata.token.royalties === 0 ? 0 : (item_metadata.token.royalties / 10).toFixed(2)}{"\u0025"}<br/>
                        Minter: </p>
                    <p className="card-text small text-muted">{truncate(item_metadata.token.minterId, 16, '\u2026')}</p>
                </div>
            </div>
        </div>
    );
}