// type for app control functions

import { Node } from "@babylonjs/core";
import { NotificationData } from "../components/Notification";
import { PlacePermissions } from "./Place";

export type FormNames = 'placeproperties'
    | 'instructions'
    | 'placeitem'
    | 'settings'
    | 'mint'
    | 'inventory'
    | 'burn'
    | 'loadingerror'
    | 'terms';

export type AppControlFunctions = {
    loadForm(form_type: FormNames): void;
    setOverlayDispaly(display: boolean): void;
    placeItem(node: Node): void;
    editPlaceProperties(groundColor: string): void;
    addNotification(data: NotificationData): void;
    updatePlaceInfo(placeId: number, owner: string, permissions: PlacePermissions): void;
};