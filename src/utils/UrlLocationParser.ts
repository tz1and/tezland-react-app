import { Vector3 } from "@babylonjs/core";
import assert from "assert";
import Conf from "../Config";
import PlaceKey from "./PlaceKey";
import WorldLocation from "./WorldLocation";


export namespace UrlLocationParser {
    export function parseLocationFromUrl(): WorldLocation | undefined {
        // TEMP-ish: get coordinates from url.
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('coordx') && urlParams.has('coordz')) {
            const yParam = urlParams.get('coordy');
            const xCoord = parseFloat(urlParams.get('coordx')!);
            const yCoord = yParam ? parseFloat(yParam) : 0;
            const zCoord = parseFloat(urlParams.get('coordz')!);

            return new WorldLocation({pos: new Vector3(
                xCoord, yCoord, zCoord
            )});
        }
        else if (urlParams.has('placeid')) {
            const placeId = parseInt(urlParams.get('placeid')!);

            return new WorldLocation({placeKey: new PlaceKey(placeId, Conf.place_contract)});
        }
        else if (urlParams.has('placekey')) {
            const place_key_array = urlParams.get('placekey')!.split(',');
            assert(place_key_array.length === 2, "placekey must have two elements");
            const placeId = parseInt(place_key_array[1]);
            const placeFA2 = place_key_array[0];

            // TODO: make sure fa2 is valid

            return new WorldLocation({placeKey: new PlaceKey(placeId, placeFA2)});
        }

        return undefined;
    }
}