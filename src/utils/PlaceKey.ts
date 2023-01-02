import Conf from "../Config";
import { Logging } from "./Logging";


export default class PlaceKey {
    readonly id: number;
    readonly fa2: string;

    constructor(id: number, fa2: string) {
        this.fa2 = fa2;
        this.id = id;
    }

    public toJson(): string {
        return JSON.stringify(this);
    }

    static fromJson(json: string): PlaceKey {
        // Assert result is actually place key?
        const res = JSON.parse(json);
        return new PlaceKey(res.id, res.fa2);
    }
};

export enum PlaceType {
    Interior = "Interior",
    Place = "Place",
    PlaceV1 = "Place (v1)",
    Unknown = "Unknown"
}

export function getPlaceType(fa2: string) {
    if (fa2 === Conf.interior_contract) return PlaceType.Interior;
    if (fa2 === Conf.place_contract) return PlaceType.Place;
    if (fa2 === Conf.place_v1_contract) return PlaceType.PlaceV1;
    Logging.ErrorDev(`Unknown place type: ${fa2}`);
    return PlaceType.Unknown;
}