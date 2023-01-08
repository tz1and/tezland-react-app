import { Vector3 } from "@babylonjs/core";
import PlaceKey from "./PlaceKey";

export default class WorldLocation {
    readonly pos?: Vector3 | undefined;
    readonly placeKey?: PlaceKey | undefined;
    readonly district?: number | undefined;

    constructor(args: {pos?: Vector3 | undefined, placeKey?: PlaceKey | undefined, district?: number | undefined}) {
        this.pos = args.pos;
        this.placeKey = args.placeKey;
        this.district = args.district;
    }

    public isValid() {
        return this.pos || this.placeKey || this.district;
    }
}