import BasePlaceNode, { PlaceType } from "./BasePlaceNode";
import { bytes2Char } from "@taquito/utils";


export default class PlaceNode extends BasePlaceNode {
    public override get placeType(): PlaceType { return "exterior"; }

    public override getName() {
        if (this.placeData) {
            const place_name = this.placeData.placeProps.get('01');
            if (place_name) return bytes2Char(place_name);
        }

        return `Place #${this.placeId}`;
    }
}