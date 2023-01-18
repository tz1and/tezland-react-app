// type for app control functions

import ItemNode from "./nodes/ItemNode";
import { MapPopoverInfo } from "./map/WorldMap";
import TokenKey from "../utils/TokenKey";
import PlaceKey from "../utils/PlaceKey";
import WorldLocation from "../utils/WorldLocation";


export interface OverlayFormProps { }

export interface PlaceItemFromProps extends OverlayFormProps {
    node: ItemNode;
    maxQuantity: number;
}

export interface TransferItemFromProps extends OverlayFormProps {
    tokenKey: TokenKey;
    maxQuantity: number;
}

export interface CollectItemFromProps extends OverlayFormProps {
    tokenKey: TokenKey;
    placeKey: PlaceKey;
    chunkId: number;
    itemId: number;
    issuer: string | null;
    xtzPerItem: number;
}

export interface DirectoryFormProps extends OverlayFormProps {
    mapCoords: [number, number];
}

export const enum OverlayForm {
    None = 0,
    PlaceProperties,
    Instructions,
    PlaceItem,
    Settings,
    Mint,
    Inventory,
    BurnItem,
    TransferItem,
    CollectItem,
    Directory,
    Terms
}

export type ChatMessage = {
    from: string | null;
    msg: string;
}

export type MapControlFunctions = {
    showPopover(data?: MapPopoverInfo): void;
};

export type iFrameControlFunctions = {
    teleportToLocation(location: WorldLocation): void;
    closeForm(): void;
}