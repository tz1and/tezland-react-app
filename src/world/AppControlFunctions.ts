// type for app control functions

import { Node } from "@babylonjs/core";
import { NotificationData } from "../components/Notification";
import PlaceNode from "./PlaceNode";

export type FormNames = 'placeproperties'
    | 'instructions'
    | 'placeitem'
    | 'settings'
    | 'mint'
    | 'inventory'
    | 'burn'
    | 'transfer'
    | 'loadingerror'
    | 'terms';

export type AppControlFunctions = {
    loadForm(form_type: FormNames): void;
    setOverlayDispaly(display: boolean): void;
    placeItem(node: Node, maxQuantity: number): void;
    addNotification(data: NotificationData): void;
    updatePlaceInfo(place: PlaceNode): void;
};