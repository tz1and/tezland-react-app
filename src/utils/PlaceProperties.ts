import { Nullable, Vector3 } from "@babylonjs/core";
import { ItemDataParser, ItemDataWriter } from "./ItemData";
import { Logging } from "./Logging";
import { fromHexString, toHexString } from "./Utils";
import { char2Bytes, bytes2Char } from "@taquito/utils";


export const colorToBytes = (color: string) => {
    // remove '#'
    const sliced = color.slice(1);
    return sliced.toLowerCase();
}

/*const placePropsDefault: Map<string, string> = new Map(Object.entries({
    "00": "82b881"
}));*/

export default class PlaceProperties {
    // General
    public placeGroundColor: string;
    public placeName: Nullable<string>;
    // Interior only:
    public interiorDisableFloor: Nullable<boolean>;
    public interiorBackgroundColor: Nullable<string>;
    public interiorLightDirection: Nullable<Vector3>;
    public interiorWaterLevel: Nullable<number>;
    // Maybe general again:
    public spawnPosition: Nullable<Vector3>;

    private oldProps: Map<string, string>;

    constructor(place_props: Map<string, string>) {
        // Decode from place properties
        this.placeGroundColor = '#' + (place_props.get('00') || "82b881");

        const name_prop = place_props.get('01');
        this.placeName = name_prop ? bytes2Char(name_prop) : null;

        // interior only props:
        const disable_floor_prop = place_props.get('02')
        this.interiorDisableFloor = disable_floor_prop ? parseInt(disable_floor_prop) !== 0 : null;

        const bg_color_prop = place_props.get('03');
        this.interiorBackgroundColor = bg_color_prop ? '#' + bg_color_prop : null;

        const light_dir_prop = place_props.get('04');
        this.interiorLightDirection = light_dir_prop ? ItemDataParser.parseVec3_16(fromHexString(light_dir_prop), 0)[0] : null;

        const spawn_pos_prop = place_props.get('05');
        this.spawnPosition = spawn_pos_prop ? PlaceProperties.parseSpawnPostion(spawn_pos_prop) : null;

        const water_levl_prop = place_props.get('06');
        this.interiorWaterLevel = water_levl_prop ? ItemDataParser.parseFloat24(fromHexString(water_levl_prop), 0)[0] : null;

        // Copy the props map to a new map.
        this.oldProps = new Map(place_props.entries());
    }

    private static serialiseVec3_16(vec: Vector3): string {
        const serialised = new Uint8Array(6);
        ItemDataWriter.writeVec3_16(serialised, vec, 0);
        return toHexString(serialised);
    }

    private static serialiseFloat_24(val: number): string {
        const serialised = new Uint8Array(3);
        ItemDataWriter.writeFloat24(serialised, val, 0);
        return toHexString(serialised);
    }

    private static parseSpawnPostion(data: string): Vector3 {
        const arr = fromHexString(data);

        if (arr.length === 6) return ItemDataParser.parseVec3_16(arr, 0)[0];
        if (arr.length === 9) return ItemDataParser.parseVec3_24(arr, 0)[0];

        Logging.Error("Invalid spawn loacation data:", data);
        return new Vector3(0, 0, 0);
    }

    private static serialiseSpawnPosition(vec: Vector3): string {
        if (ItemDataWriter.needsFloat24(vec)) {
            const serialised = new Uint8Array(9);
            ItemDataWriter.writeVec3_24(serialised, vec, 0);
            return toHexString(serialised);
        }
        else {
            const serialised = new Uint8Array(6);
            ItemDataWriter.writeVec3_16(serialised, vec, 0);
            return toHexString(serialised);
        }
    }

    private encode(): Map<string, string> {
        const encoded_props = new Map<string, string>();

        encoded_props.set('00', colorToBytes(this.placeGroundColor));
        
        if (this.placeName) encoded_props.set('01', char2Bytes(this.placeName));

        if (this.interiorDisableFloor) encoded_props.set('02', char2Bytes('1'));

        if (this.interiorBackgroundColor) encoded_props.set('03', colorToBytes(this.interiorBackgroundColor));

        if (this.interiorLightDirection) encoded_props.set('04', PlaceProperties.serialiseVec3_16(this.interiorLightDirection));

        if (this.spawnPosition) encoded_props.set('05', PlaceProperties.serialiseSpawnPosition(this.spawnPosition));

        if (this.interiorWaterLevel) encoded_props.set('06', PlaceProperties.serialiseFloat_24(this.interiorWaterLevel));

        return encoded_props;
    }

    public getChangesAndRemovals(): [Map<string, string>, string[]] {
        const new_props = this.encode();

        // Removals are keys in old props that are not in new props.
        const removals: string[] = [];
        for (const key of this.oldProps.keys()) {
            if (!new_props.has(key)) removals.push(key);
        }

        // changes are keys in new props that are no in old props or changed.
        const changes = new Map<string, string>();
        for (const [key, value] of new_props.entries()) {
            const old = this.oldProps.get(key);
            if (!old || old !== value) changes.set(key, value);
        }

        return [changes, removals];
    }
}