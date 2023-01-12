import { DeepImmutable, Nullable, Quaternion, Vector3 } from "@babylonjs/core";
import assert from "assert";
import { packTo, unpack } from "byte-data";
import Conf from "../Config";
import PlaceKey from "./PlaceKey";
import { fromHexString } from "./Utils";
import WorldLocation from "./WorldLocation";

export const enum TeleporterType {
    Exterior = 0,
    Interior = 1,
    Local = 2
}

export type TeleporterData = {
    type: TeleporterType;
    placeId?: number;
    position?: Vector3;
}

export function toWorldLoaction(teleporter_data: TeleporterData): WorldLocation {
    switch(teleporter_data.type){
        case TeleporterType.Exterior:
            assert(teleporter_data.placeId !== undefined, "placeId is undefined");
            return new WorldLocation({placeKey: new PlaceKey(teleporter_data.placeId, Conf.place_contract)})

        case TeleporterType.Interior:
            assert(teleporter_data.placeId !== undefined, "placeId is undefined");
            return new WorldLocation({placeKey: new PlaceKey(teleporter_data.placeId, Conf.interior_contract)})

        default:
            throw new Error(`Unsupported teleporter type: ${teleporter_data.type}`);
    }
}

export const enum ItemDataFlags {
    NONE = 0,
    DISABLE_COLLISIONS = 1,
    RECIEVE_SHADOWS = 2
}

export function hasFlag(flags: ItemDataFlags, flag: ItemDataFlags) {
    return (flags & flag) === flag;
}

type FloatBits = 16 | 24 | 32 | 64;
type UintBits = 8 | 16 | 32;

function sizeForBits(bits: FloatBits | UintBits): number {
    return Math.trunc(bits / 8);
}

export class ItemDataParser {

    public static parse(data: string): [Quaternion, Vector3, number, ItemDataFlags, Nullable<TeleporterData>] {
        const uint8array: Uint8Array = fromHexString(data);

        let format, nextIdx;
        [format, nextIdx] = this.parseUint8(uint8array, 0);
        
        let quat: Quaternion, pos: Vector3, scale: number;
        if (format === 0)
            [quat, pos, scale, nextIdx] = this.parseFormat0(uint8array, nextIdx);
        else if (format === 1)
            [quat, pos, scale, nextIdx] = this.parseFormat1(uint8array, nextIdx);
        else if (format === 2)
            [quat, pos, scale, nextIdx] = this.parseFormat2(uint8array, nextIdx);
        else throw new Error('Unknown item data format');
        
        let chunk: Nullable<TeleporterData> = null;
        while (uint8array.length - nextIdx > 1) {
            [chunk, nextIdx] = this.parseChunk(uint8array, nextIdx);
        }
        
        let flags = ItemDataFlags.NONE;
        if (uint8array.length - nextIdx === 1) [flags] = this.parseUint8(uint8array, nextIdx);

        return [quat, pos, scale, flags, chunk];
    }

    /**
     * Parse Item data format 0:
     * 3 float16 pos = 6 bytes (this is also the minimum item data length)
     * @param uint8array 
     * @param startIdx 
     * @returns 
     */
    private static parseFormat0(uint8array: Uint8Array, startIdx: number): [Quaternion, Vector3, number, number] {
        // NOTE: check total length including format.
        assert(uint8array.length >= 7);

        let [pos, nextIdx] = this.parseVec3_16(uint8array, startIdx);

        return [Quaternion.Identity(), pos, 1.0, nextIdx];
    }

    /**
     * Parse Item data format 1:
     * 3 float16 for euler angles, 3 float16 pos, 1 float16 scale = 14 bytes
     * @param uint8array 
     * @param startIdx 
     * @returns 
     */
    private static parseFormat1(uint8array: Uint8Array, startIdx: number): [Quaternion, Vector3, number, number] {
        // NOTE: check total length including format.
        assert(uint8array.length >= 15);

        let eulerAngles, nextIdx;
        [eulerAngles, nextIdx] = this.parseVec3_16(uint8array, startIdx);
        const quat = Quaternion.FromEulerAngles(eulerAngles.x, eulerAngles.y, eulerAngles.z);

        let pos;
        [pos, nextIdx] = this.parseVec3_16(uint8array, nextIdx);
        
        let scale;
        [scale, nextIdx] = this.parseFloat16(uint8array, nextIdx);

        return [quat, pos, scale, nextIdx];
    }

    /**
     * Parse Item data format 2:
     * 3 float16 for euler angles, 3 float24 pos, 1 float16 scale = 17 bytes
     * @param uint8array 
     * @param startIdx 
     * @returns 
     */
    private static parseFormat2(uint8array: Uint8Array, startIdx: number): [Quaternion, Vector3, number, number] {
        // NOTE: check total length including format.
        assert(uint8array.length >= 18);

        let eulerAngles, nextIdx;
        [eulerAngles, nextIdx] = this.parseVec3_16(uint8array, startIdx);
        const quat = Quaternion.FromEulerAngles(eulerAngles.x, eulerAngles.y, eulerAngles.z);

        let pos;
        [pos, nextIdx] = this.parseVec3_24(uint8array, nextIdx);
        
        let scale;
        [scale, nextIdx] = this.parseFloat16(uint8array, nextIdx);

        return [quat, pos, scale, nextIdx];
    }

    private static parseChunk(uint8array: Uint8Array, startIdx: number): [TeleporterData, number] {
        // parse chunk type
        let [chunkType, nextIdx] = this.parseUint8(uint8array, startIdx)

        if (chunkType <= 4)
            return this.parseTeleporter(uint8array, chunkType, nextIdx);
        
        throw new Error("Unknown chunk type");
    }

    /**
     * Valid teleporter chunk types are:
     * 0: uint16 exterior place id
     * 1: uint32 exterior place id
     * 2: uint16 interior id
     * 3: uint32 interior id
     * 4: 3 float16 position
     * @param uint8array 
     * @param startIdx 
     * @returns 
     */
    private static parseTeleporter(uint8array: Uint8Array, chunkType: number, startIdx: number): [TeleporterData, number] {
        // If it's a local teleporter.
        if (chunkType === 4) {
            const [pos, nextIdx] = this.parseVec3_16(uint8array, startIdx);
            return [{
                type: TeleporterType.Local,
                position: pos
            }, nextIdx] 
        }

        // Otherwise, if it's a teleporter to a place.
        let type: TeleporterType;
        let placeId: number;

        let nextIdx;
        switch(chunkType) {
            case 0:
                type = TeleporterType.Exterior;
                [placeId, nextIdx] = this.parseUint16(uint8array, startIdx);
                break;
            case 1:
                type = TeleporterType.Exterior;
                [placeId, nextIdx] = this.parseUint32(uint8array, startIdx);
                break;
            case 2:
                type = TeleporterType.Interior;
                [placeId, nextIdx] = this.parseUint16(uint8array, startIdx);
                break;
            case 3:
                type = TeleporterType.Interior;
                [placeId, nextIdx] = this.parseUint32(uint8array, startIdx);
                break;
            default:
                throw new Error("Unknown teleporter chunk type");
        }

        return [{
            type: type,
            placeId: placeId
        }, nextIdx]
    }

    /**
     * Parses a uint from the array.
     * @param bits the number of bits in the uint
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedValue, nextIdx)
     */
    private static parseUint(bits: UintBits, uint8array: Uint8Array, startIdx: number): [parsedValue: number, nextIdx: number] {
        const val = unpack(uint8array, { bits: bits, signed: false, be: true }, startIdx);
        return [val, startIdx + sizeForBits(bits)];
    }

    private static parseUint8(uint8array: Uint8Array, startIdx: number) { return this.parseUint(8, uint8array, startIdx) }
    private static parseUint16(uint8array: Uint8Array, startIdx: number) { return this.parseUint(16, uint8array, startIdx) }
    private static parseUint32(uint8array: Uint8Array, startIdx: number) { return this.parseUint(32, uint8array, startIdx) }

    /**
     * Parses a float16 from the array.
     * @param bits the number of bits in the float
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedValue, nextIdx)
     */
    private static parseFloat(bits: FloatBits, uint8array: Uint8Array, startIdx: number): [parsedValue: number, nextIdx: number] {
        const val = unpack(uint8array, { bits: bits, fp: true, be: true }, startIdx);
        return [val, startIdx + sizeForBits(bits)];
    }

    public static parseFloat16(uint8array: Uint8Array, startIdx: number) { return this.parseFloat(16, uint8array, startIdx) }
    public static parseFloat24(uint8array: Uint8Array, startIdx: number) { return this.parseFloat(24, uint8array, startIdx) }
    private static parseFloat32(uint8array: Uint8Array, startIdx: number) { return this.parseFloat(32, uint8array, startIdx) }
    private static parseFloat64(uint8array: Uint8Array, startIdx: number) { return this.parseFloat(64, uint8array, startIdx) }

    /**
     * Parses a 16 bit Vector3 from the array.
     * @param bits the number of bits in the vector components
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedVector, nextIdx)
     */
    private static parseVec3(bits: FloatBits, uint8array: Uint8Array, startIdx: number): [parsedVector: Vector3, nextIdx: number] {
        let nextIdx, x, y, z;
        [x, nextIdx] = this.parseFloat(bits, uint8array, startIdx);
        [y, nextIdx] = this.parseFloat(bits, uint8array, nextIdx);
        [z, nextIdx] = this.parseFloat(bits, uint8array, nextIdx);
        
        return [new Vector3(x, y, z), nextIdx];
    }

    public static parseVec3_16(uint8array: Uint8Array, startIdx: number) { return this.parseVec3(16, uint8array, startIdx) }
    public static parseVec3_24(uint8array: Uint8Array, startIdx: number) { return this.parseVec3(24, uint8array, startIdx) }
    private static parseVec3_32(uint8array: Uint8Array, startIdx: number) { return this.parseVec3(32, uint8array, startIdx) }
    private static parseVec3_64(uint8array: Uint8Array, startIdx: number) { return this.parseVec3(64, uint8array, startIdx) }
}

// TODO: Change to some interface that provieds all the fields
export interface IItemData {
    position: Vector3;
    scaling: Vector3;
    rotationQuaternion: Nullable<Quaternion>;
    disableCollision: boolean;
    recieveShadows: boolean;
    teleporterData: Nullable<TeleporterData>;
}

export class ItemDataWriter {
    public static needsFloat24(vec: DeepImmutable<Vector3>): boolean {
        let needs_float24 = false;
        for (const component of vec.asArray()) {
            if (Math.abs(component) >= 128.0) needs_float24 = true;
        }
        return needs_float24;
    }

    public static write(item: IItemData): Uint8Array {
        const chunks: Uint8Array[] = [];
        
        // create array of uint8arrays
        chunks.push(this.writeItemData(item));
        // TODO:
        // push any other chunks
        if (item.teleporterData !== null) chunks.push(this.writeTeleporter(item.teleporterData));
        const flags = this.writeFlags(item)
        if (flags) chunks.push(flags);
        // push flags
        
        return this.mergeArrays(chunks);
    }

    private static writeItemData(item: IItemData): Uint8Array {
        // TODO: if identity scale and rotation
        // return writeFromat0(item);
        // else
        // TODO: if any pos component >= 128.0
        // return writeFromat2(item);
        // else
        const needs_float24 = this.needsFloat24(item.position);

        if (needs_float24) return this.writeFromat2(item);
        else return this.writeFromat1(item);
    }

    private static writeFlags(item: IItemData): Uint8Array | null {
        let flags = ItemDataFlags.NONE;
        if (item.disableCollision)
            flags |= ItemDataFlags.DISABLE_COLLISIONS;
        if (item.recieveShadows)
            flags |= ItemDataFlags.RECIEVE_SHADOWS;

        if (flags !== ItemDataFlags.NONE) {
            const arr = new Uint8Array(1);
            this.writeUint8(arr, flags, 0);
            return arr;
        }

        return null;
    }

    /**
     * Valid teleporter chunk types are:
     * 0: uint16 exterior place id
     * 1: uint32 exterior place id
     * 2: uint16 interior id
     * 3: uint32 interior id
     * 4: 3 float16 position
     * @param item 
     */
    private static writeTeleporter(tele: TeleporterData): Uint8Array {
        // To another place
        if (tele.placeId !== undefined) {
            // 32 bit
            if (tele.placeId > 65535) {
                const arr = new Uint8Array(5);

                if (tele.type === TeleporterType.Exterior) {
                    this.writeUint8(arr, 1, 0);
                    this.writeUint32(arr, tele.placeId, 1);
                }
                else {
                    this.writeUint8(arr, 3, 0);
                    this.writeUint32(arr, tele.placeId, 1);
                }

                return arr;
            }
            // 16 bit
            else {
                const arr = new Uint8Array(3);

                if (tele.type === TeleporterType.Exterior) {
                    this.writeUint8(arr, 0, 0);
                    this.writeUint16(arr, tele.placeId, 1);
                }
                else {
                    this.writeUint8(arr, 2, 0);
                    this.writeUint16(arr, tele.placeId, 1);
                }

                return arr;
            }
        }
        // Local
        else if (tele.position !== undefined) {
            const arr = new Uint8Array(7);
            this.writeUint8(arr, 4, 0);
            this.writeVec3_16(arr, tele.position, 1);
            return arr;
        }
        else {
            throw new Error("Invalid teleporter data");
        }
    }

    /**
     * Write Item data format 0:
     * 1 byte format, 3 float16 pos = 7 bytes (this is also the minimum item data length)
     * @param item
     * @returns 
     */
     private static writeFromat0(item: IItemData): Uint8Array {
        const itemData0 = new Uint8Array(7);
        
        // Write format
        let nextIdx = this.writeUint8(itemData0, 0, 0);

        // Write pos
        this.writeVec3_16(itemData0, item.position, nextIdx); // TODO: figure out which pos to use

        return itemData0;
    }

    /**
     * Write Item data format 1:
     * 1 byte format, 3 float16 for euler angles, 3 float16 pos, 1 float16 scale = 15 bytes
     * @param item
     * @returns 
     */
    private static writeFromat1(item: IItemData): Uint8Array {
        const itemData1 = new Uint8Array(15);

        // Write format
        let nextIdx = this.writeUint8(itemData1, 1, 0);

        // Write pos, rot, scake
        const rot = item.rotationQuaternion ? item.rotationQuaternion : Quaternion.Identity();
        const euler_angles = rot.toEulerAngles();

        nextIdx = this.writeVec3_16(itemData1, euler_angles, nextIdx);
        nextIdx = this.writeVec3_16(itemData1, item.position, nextIdx);
        this.writeFloat16(itemData1, item.scaling.x, nextIdx);

        return itemData1;
    }

    /**
     * Write Item data format 1:
     * 1 byte format, 3 float16 for euler angles, 3 float24 pos, 1 float16 scale = 18 bytes
     * @param item
     * @returns 
     */
    private static writeFromat2(item: IItemData): Uint8Array {
        const itemData2 = new Uint8Array(18);

        // Write format
        let nextIdx = this.writeUint8(itemData2, 2, 0);

        // Write pos, rot, scake
        const rot = item.rotationQuaternion ? item.rotationQuaternion : Quaternion.Identity();
        const euler_angles = rot.toEulerAngles();

        nextIdx = this.writeVec3_16(itemData2, euler_angles, nextIdx);
        nextIdx = this.writeVec3_24(itemData2, item.position, nextIdx);
        this.writeFloat16(itemData2, item.scaling.x, nextIdx);

        return itemData2;
    }

    private static mergeArrays(uint8arrays: Uint8Array[]) {
        const total_len = uint8arrays.map(a => a.length).reduce((prev, current) => {
            return prev + current;
        }, 0);

        const finalArray = new Uint8Array(total_len);

        let startIdx = 0;
        for (const a of uint8arrays) {
            finalArray.set(a, startIdx);
            startIdx += a.length;
        }

        return finalArray;
    }

    /**
     * Write a uint8 to the array
     * @param bits the number of bits in the uint
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
    private static writeUint(bits: UintBits, uint8array: Uint8Array, val: number, startIdx: number): number {
        // TODO: assert integer, assert range
        packTo(val, { bits: bits, signed: false, be: true }, uint8array, startIdx);
        return startIdx + sizeForBits(bits);
    }

    private static writeUint8(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeUint(8, uint8array, val, startIdx) }
    private static writeUint16(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeUint(16, uint8array, val, startIdx) }
    private static writeUint32(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeUint(32, uint8array, val, startIdx) }

    /**
     * Write a float16 to the array
     * @param bits the number of bits in the float
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
    private static writeFloat(bits: FloatBits, uint8array: Uint8Array, val: number, startIdx: number): number {
        // TODO: assert integer, assert range
        packTo(val, { bits: bits, fp: true, be: true }, uint8array, startIdx);
        return startIdx + sizeForBits(bits);
    }

    public static writeFloat16(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeFloat(16, uint8array, val, startIdx) }
    public static writeFloat24(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeFloat(24, uint8array, val, startIdx) }
    private static writeFloat32(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeFloat(32, uint8array, val, startIdx) }
    private static writeFloat64(uint8array: Uint8Array, val: number, startIdx: number) { return this.writeFloat(64, uint8array, val, startIdx) }

    /**
     * Write a float16 to the array
     * @param bits the number of bits in a component
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
    private static writeVec3(bits: FloatBits, uint8array: Uint8Array, val: Vector3, startIdx: number): number {
        // TODO: assert integer, assert range
        let nextIdx = this.writeFloat(bits, uint8array, val.x, startIdx);
        nextIdx = this.writeFloat(bits, uint8array, val.y, nextIdx);
        return this.writeFloat(bits, uint8array, val.z, nextIdx);
    }

    public static writeVec3_16(uint8array: Uint8Array, val: Vector3, startIdx: number) { return this.writeVec3(16, uint8array, val, startIdx) }
    public static writeVec3_24(uint8array: Uint8Array, val: Vector3, startIdx: number) { return this.writeVec3(24, uint8array, val, startIdx) }
    private static writeVec3_32(uint8array: Uint8Array, val: Vector3, startIdx: number) { return this.writeVec3(32, uint8array, val, startIdx) }
    private static writeVec3_64(uint8array: Uint8Array, val: Vector3, startIdx: number) { return this.writeVec3(64, uint8array, val, startIdx) }
}