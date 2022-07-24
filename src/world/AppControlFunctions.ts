// type for app control functions

import { NotificationData } from "../components/Notification";
import ItemNode from "./ItemNode";
import PlaceNode from "./PlaceNode";
import { MapPopoverInfo } from "./WorldMap";

export interface OverlayFormProps {}

export interface PlaceItemFromProps extends OverlayFormProps {
    node: ItemNode;
    maxQuantity: number;
}

export interface TransferItemFromProps extends OverlayFormProps {
    tokenId: number;
    maxQuantity: number;
}

export interface CollectItemFromProps extends OverlayFormProps {
    tokenId: number;
    placeId: number;
    itemId: number;
    issuer: string;
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

export type AppControlFunctions = {
    loadForm(form_type: OverlayForm, props?: OverlayFormProps): void;
    addNotification(data: NotificationData): void;
    updatePlaceInfo(place: PlaceNode): void;
    unlockControls(): void;
};

export type MapControlFunctions = {
    showPopover(data?: MapPopoverInfo): void;
};

export type iFrameControlFunctions = {
    teleportToWorldPos(pos: [number, number]): void;
    teleportToLocation(location: string): void;
    closeForm(): void;
}
