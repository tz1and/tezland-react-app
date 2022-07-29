import { Nullable, Quaternion, Vector3 } from "@babylonjs/core";
import assert from "assert";
import { packTo, unpack } from "byte-data";
import { fromHexString } from "./Utils";

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

export const enum ItemDataFlags {
    NONE = 0,
    DISABLE_COLLISIONS = 1
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
     * 3 floats pos = 6 bytes (this is also the minimum item data length)
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
     * 3 floats for euler angles, 3 floats pos, 1 float scale = 14 bytes
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
     * Parses a uint8 from the array.
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedValue, nextIdx)
     */
    private static parseUint8(uint8array: Uint8Array, startIdx: number): [parsedValue: number, nextIdx: number] {
        const val = unpack(uint8array, { bits: 8, signed: false, be: true }, startIdx);
        return [val, startIdx+1];
    }

    /**
     * Parses a uint16 from the array.
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedValue, nextIdx)
     */
    private static parseUint16(uint8array: Uint8Array, startIdx: number): [parsedValue: number, nextIdx: number] {
        const val = unpack(uint8array, { bits: 16, signed: false, be: true }, startIdx);
        return [val, startIdx+2];
    }

    /**
     * Parses a uint32 from the array.
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedValue, nextIdx)
     */
    private static parseUint32(uint8array: Uint8Array, startIdx: number): [parsedValue: number, nextIdx: number] {
        const val = unpack(uint8array, { bits: 32, signed: false, be: true }, startIdx);
        return [val, startIdx+4];
    }

    /**
     * Parses a float16 from the array.
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedValue, nextIdx)
     */
     private static parseFloat16(uint8array: Uint8Array, startIdx: number): [parsedValue: number, nextIdx: number] {
        const val = unpack(uint8array, { bits: 16, fp: true, be: true }, startIdx);
        return [val, startIdx+2];
    }

    /**
     * Parses a 16 bit Vector3 from the array.
     * @param uint8array a Uint8Array 
     * @param startIdx the index to start at
     * @returns a tuble of (parsedVector, nextIdx)
     */
     private static parseVec3_16(uint8array: Uint8Array, startIdx: number): [parsedVector: Vector3, nextIdx: number] {
        let nextIdx, x, y, z;
        [x, nextIdx] = this.parseFloat16(uint8array, startIdx);
        [y, nextIdx] = this.parseFloat16(uint8array, nextIdx);
        [z, nextIdx] = this.parseFloat16(uint8array, nextIdx);
        
        return [new Vector3(x, y, z), nextIdx];
    }
}

// TODO: Change to some interface that provieds all the fields
export interface IItemData {
    position: Vector3;
    scaling: Vector3;
    rotationQuaternion: Nullable<Quaternion>;
    disableCollisions: boolean;
    teleporterData: Nullable<TeleporterData>;
}

export class ItemDataWriter {
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
        return this.writeFromat1(item);
    }

    private static writeFlags(item: IItemData): Uint8Array | null {
        let flags = ItemDataFlags.NONE;
        if (item.disableCollisions)
            flags |= ItemDataFlags.DISABLE_COLLISIONS;

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
     * 1 byte format, 3 floats pos = 7 bytes (this is also the minimum item data length)
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
     * Parse Item data format 1:
     * 1 byte format, 3 floats for euler angles, 3 floats pos, 1 float scale = 15 bytes
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
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
    private static writeUint8(uint8array: Uint8Array, val: number, startIdx: number): number {
        // TODO: assert integer, assert range
        packTo(val, { bits: 8, signed: false, be: true }, uint8array, startIdx);
        return startIdx+1;
    }

    /**
     * Write a uint16 to the array
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
     private static writeUint16(uint8array: Uint8Array, val: number, startIdx: number): number {
        // TODO: assert integer, assert range
        packTo(val, { bits: 16, signed: false, be: true }, uint8array, startIdx);
        return startIdx+2;
    }

    /**
     * Write a uint32 to the array
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
     private static writeUint32(uint8array: Uint8Array, val: number, startIdx: number): number {
        // TODO: assert integer, assert range
        packTo(val, { bits: 32, signed: false, be: true }, uint8array, startIdx);
        return startIdx+4;
    }

    /**
     * Write a float16 to the array
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
     private static writeFloat16(uint8array: Uint8Array, val: number, startIdx: number): number {
        // TODO: assert integer, assert range
        packTo(val, { bits: 16, fp: true, be: true }, uint8array, startIdx);
        return startIdx+2;
    }

    /**
     * Write a float16 to the array
     * @param uint8array a Uint8Array 
     * @param val the value to write
     * @param startIdx the index to start at
     * @returns nextIdx
     */
     private static writeVec3_16(uint8array: Uint8Array, val: Vector3, startIdx: number): number {
        // TODO: assert integer, assert range
        let nextIdx = this.writeFloat16(uint8array, val.x, startIdx);
        nextIdx = this.writeFloat16(uint8array, val.y, nextIdx);
        return this.writeFloat16(uint8array, val.z, nextIdx);
    }
}