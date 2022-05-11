import { Quaternion, Vector3 } from "@babylonjs/core";
import assert from "assert";
import { unpack } from "byte-data";
import { fromHexString } from "./Utils";


export default class ItemData {

    public static parse(data: string): [Quaternion, Vector3, number] {
        const uint8array: Uint8Array = fromHexString(data);
        // NOTE: for now we assume format version 1
        // 1 byte format, 3 floats for euler angles, 3 floats pos, 1 float scale = 15 bytes
        assert(uint8array.length >= 15);
        const format = unpack(uint8array, { bits: 8, signed: false, be: true }, 0);
        assert(format === 1);
        const type = { bits: 16, fp: true, be: true };
        const quat = Quaternion.FromEulerAngles(
            unpack(uint8array, type, 1),
            unpack(uint8array, type, 3),
            unpack(uint8array, type, 5));
        const pos = new Vector3(
            unpack(uint8array, type, 7),
            unpack(uint8array, type, 9),
            unpack(uint8array, type, 11));
        const scale = unpack(uint8array, type, 13);

        return [quat, pos, scale];
    }

}
