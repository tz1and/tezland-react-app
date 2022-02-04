// type for app control functions

import { Node } from "@babylonjs/core";
import { NotificationData } from "../components/Notification";

export type AppControlFunctions = {
    loadForm(form_type: string): void;
    setOverlayDispaly(display: boolean): void;
    placeItem(node: Node): void;
    addNotification(data: NotificationData): void;
    updatePlaceInfo(placeId: number, owner: string, ownedOrOperated: boolean): void;
};