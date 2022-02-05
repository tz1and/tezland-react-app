// type for app control functions

import { Node } from "@babylonjs/core";
import { NotificationData } from "../components/Notification";

export type FromNames = 'placeproperties' | 'instructions' | 'placeitem' | 'settings' | 'mint' | 'inventory';

export type AppControlFunctions = {
    loadForm(form_type: FromNames): void;
    setOverlayDispaly(display: boolean): void;
    placeItem(node: Node): void;
    editPlaceProperties(groundColor: string): void;
    addNotification(data: NotificationData): void;
    updatePlaceInfo(placeId: number, owner: string, ownedOrOperated: boolean): void;
};