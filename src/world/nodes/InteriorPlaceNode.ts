import BasePlaceNode from "./BasePlaceNode";
import { bytes2Char } from "@taquito/utils";
import { InteriorWorld } from "../InteriorWorld";
import PlaceProperties from "../../utils/PlaceProperties";
import { assert } from "../../utils/Assert";


export default class InteriorPlaceNode extends BasePlaceNode {
    public override getName() {
        if (this.placeData) {
            const place_name = this.placeData.placeProps.get('01');
            if (place_name) return bytes2Char(place_name);
        }

        return `Interior #${this.placeKey.id}`;
    }

    public override updateOnPlacePropChange(props: PlaceProperties, first_load: boolean): void {
        assert(this.placeGround);
        this.placeGround.setEnabled(!(props.interiorDisableFloor || false));

        assert(this.world instanceof InteriorWorld);
        const interior_world = this.world as InteriorWorld;
        interior_world.updateOnPlacePropChange(props, first_load);
    }
}