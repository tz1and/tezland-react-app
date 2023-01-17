// type for app control functions

import { NotificationData } from "../components/Notification";
import ItemNode from "./nodes/ItemNode";
import BasePlaceNode from "./nodes/BasePlaceNode";
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

export class EventDispatcher<T> {
    private subscriptions = new Set<(data: T) => any>()

    dispatch(data: T) {
        this.subscriptions.forEach(callback => callback(data))
    }

    subscribe(callback: (data: T) => any) {
        this.subscriptions.add(callback);
    }

    unsubscribe(callback: (data: T) => any) {
        this.subscriptions.delete(callback);
    }

    dispose() {
        /*if (isDev() && this.subscriptions.size > 0) {
            Logging.ErrorDev("Warning: EventDispatcher has active subscriptions on dispose", this.subscriptions)
        }*/
        this.subscriptions.clear();
    }
}

export class AppControl {
    loadForm = new EventDispatcher<{form_type: OverlayForm, props?: OverlayFormProps}>();
    addNotification = new EventDispatcher<NotificationData>();
    newChatMessage = new EventDispatcher<ChatMessage>();
    updatePlaceInfo = new EventDispatcher<BasePlaceNode>();
    unlockControls = new EventDispatcher<void>();

    dispose() {
        this.loadForm.dispose();
        this.addNotification.dispose();
        this.newChatMessage.dispose();
        this.updatePlaceInfo.dispose();
        this.unlockControls.dispose();
    }
}