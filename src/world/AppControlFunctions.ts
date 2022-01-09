// type for app control functions

import { Node } from "@babylonjs/core";

export type AppControlFunctions = {
    loadForm(form_type: string): void;
    setOverlayDispaly(display: boolean): void;
    placeItem(node: Node): void;
};