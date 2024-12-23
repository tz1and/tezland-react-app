import { Quaternion, Vector3 } from '@babylonjs/core/Maths';
import { IItemData, ItemDataFlags, ItemDataParser, ItemDataWriter, TeleporterData, TeleporterType } from './ItemData';
import { toHexString } from './Utils';

// TODO: make sure failure cases fail correctly.

test('uint8', () => {
    const arr = new Uint8Array(1);

    expect((ItemDataWriter as any).writeUint8(arr, 75, 0)).toEqual(1);

    expect((ItemDataParser as any).parseUint8(arr, 0)).toStrictEqual([75, 1]);
});

test('uint16', () => {
    const arr = new Uint8Array(2);

    expect((ItemDataWriter as any).writeUint16(arr, 37859, 0)).toEqual(2);

    expect((ItemDataParser as any).parseUint16(arr, 0)).toStrictEqual([37859, 2]);
});

test('uint32', () => {
    const arr = new Uint8Array(4);

    expect((ItemDataWriter as any).writeUint32(arr, 1378596, 0)).toEqual(4);

    expect((ItemDataParser as any).parseUint32(arr, 0)).toStrictEqual([1378596, 4]);
});

test('float16', () => {
    const arr = new Uint8Array(2);

    expect((ItemDataWriter as any).writeFloat16(arr, 1.5, 0)).toEqual(2);

    expect((ItemDataParser as any).parseFloat16(arr, 0)).toStrictEqual([1.5, 2]);
});

test('float24', () => {
    const arr = new Uint8Array(3);

    expect((ItemDataWriter as any).writeFloat24(arr, 1.5, 0)).toEqual(3);

    expect((ItemDataParser as any).parseFloat24(arr, 0)).toStrictEqual([1.5, 3]);
});

test('float32', () => {
    const arr = new Uint8Array(4);

    expect((ItemDataWriter as any).writeFloat32(arr, 1.5, 0)).toEqual(4);

    expect((ItemDataParser as any).parseFloat32(arr, 0)).toStrictEqual([1.5, 4]);
});

test('float64', () => {
    const arr = new Uint8Array(8);

    expect((ItemDataWriter as any).writeFloat64(arr, 1.5, 0)).toEqual(8);

    expect((ItemDataParser as any).parseFloat64(arr, 0)).toStrictEqual([1.5, 8]);
});

test('Vec3_16', () => {
    const arr = new Uint8Array(6);

    expect((ItemDataWriter as any).writeVec3_16(arr, new Vector3(0.0, 1.0, 1.5), 0)).toEqual(6);

    expect((ItemDataParser as any).parseVec3_16(arr, 0)).toStrictEqual([new Vector3(0.0, 1.0, 1.5), 6]);
});

test('Vec3_24', () => {
    const arr = new Uint8Array(9);

    expect((ItemDataWriter as any).writeVec3_24(arr, new Vector3(0.0, 1.0, 1.5), 0)).toEqual(9);

    expect((ItemDataParser as any).parseVec3_24(arr, 0)).toStrictEqual([new Vector3(0.0, 1.0, 1.5), 9]);
});

test('Vec3_32', () => {
    const arr = new Uint8Array(12);

    expect((ItemDataWriter as any).writeVec3_32(arr, new Vector3(0.0, 1.0, 1.5), 0)).toEqual(12);

    expect((ItemDataParser as any).parseVec3_32(arr, 0)).toStrictEqual([new Vector3(0.0, 1.0, 1.5), 12]);
});

test('Vec3_64', () => {
    const arr = new Uint8Array(24);

    expect((ItemDataWriter as any).writeVec3_64(arr, new Vector3(0.0, 1.0, 1.5), 0)).toEqual(24);

    expect((ItemDataParser as any).parseVec3_64(arr, 0)).toStrictEqual([new Vector3(0.0, 1.0, 1.5), 24]);
});

describe('Teleporter', () => {
    it('Interior 16', () => {
        const tele: TeleporterData = {
            type: TeleporterType.Interior,
            placeId: 65535
        }

        const arr = (ItemDataWriter as any).writeTeleporter(tele);
        expect(arr).toHaveLength(3);

        const [teleParsed, nextIdx] = (ItemDataParser as any).parseChunk(arr, 0);
        expect(teleParsed).toStrictEqual(tele);
        expect(nextIdx).toEqual(3);
    });

    it('Interior 32', () => {
        const tele: TeleporterData = {
            type: TeleporterType.Interior,
            placeId: 65536
        }

        const arr = (ItemDataWriter as any).writeTeleporter(tele);
        expect(arr).toHaveLength(5);

        const [teleParsed, nextIdx] = (ItemDataParser as any).parseChunk(arr, 0);
        expect(teleParsed).toStrictEqual(tele);
        expect(nextIdx).toEqual(5);
    });

    it('Exterior 16', () => {
        const tele: TeleporterData = {
            type: TeleporterType.Exterior,
            placeId: 65535
        }

        const arr = (ItemDataWriter as any).writeTeleporter(tele);
        expect(arr).toHaveLength(3);

        const [teleParsed, nextIdx] = (ItemDataParser as any).parseChunk(arr, 0);
        expect(teleParsed).toStrictEqual(tele);
        expect(nextIdx).toEqual(3);
    });

    it('Exterior 32', () => {
        const tele: TeleporterData = {
            type: TeleporterType.Exterior,
            placeId: 65536
        }

        const arr = (ItemDataWriter as any).writeTeleporter(tele);
        expect(arr).toHaveLength(5);

        const [teleParsed, nextIdx] = (ItemDataParser as any).parseChunk(arr, 0);
        expect(teleParsed).toStrictEqual(tele);
        expect(nextIdx).toEqual(5);
    });

    it('Local', () => {
        const tele: TeleporterData = {
            type: TeleporterType.Local,
            position: new Vector3(1, 1.5, 1)
        }

        const arr = (ItemDataWriter as any).writeTeleporter(tele);
        expect(arr).toHaveLength(7);

        const [teleParsed, nextIdx] = (ItemDataParser as any).parseChunk(arr, 0);
        expect(teleParsed).toStrictEqual(tele);
        expect(nextIdx).toEqual(7);
    });
});

describe('IItemData with flags', () => {
    const node: IItemData = {
        position: new Vector3(0.0, 1.0, 1.5),
        scaling: new Vector3(1.5, 1.5, 1.5),
        rotationQuaternion: Quaternion.Identity(),
        disableCollision: true,
        recieveShadows: false,
        teleporterData: null
    };

    it('without teleporter data', () => {
        const arr = ItemDataWriter.write(node);
        expect(arr).toHaveLength(16);

        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
        expect(pos).toStrictEqual(node.position);
        expect(quat).toStrictEqual(node.rotationQuaternion);
        expect(scale).toEqual(node.scaling.x);
        expect(flags).toEqual(ItemDataFlags.DISABLE_COLLISIONS);
        expect(tele).toBeNull();
    });

    it('with teleporter data', () => {
        node.teleporterData = {
            type: TeleporterType.Exterior,
            placeId: 1234
        };

        const arr = ItemDataWriter.write(node);
        expect(arr).toHaveLength(19);

        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
        expect(pos).toStrictEqual(node.position);
        expect(quat).toStrictEqual(node.rotationQuaternion);
        expect(scale).toEqual(node.scaling.x);
        expect(flags).toEqual(ItemDataFlags.DISABLE_COLLISIONS);
        expect(tele).toStrictEqual(node.teleporterData);
    });
});

describe('IItemData without flags', () => {
    const node: IItemData = {
        position: new Vector3(0.0, 1.0, 1.5),
        scaling: new Vector3(1.5, 1.5, 1.5),
        rotationQuaternion: Quaternion.Identity(),
        disableCollision: false,
        recieveShadows: false,
        teleporterData: null
    };

    it('without teleporter data', () => {
        const arr = ItemDataWriter.write(node);
        expect(arr).toHaveLength(15);

        // TODO: parse it.
        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
        expect(pos).toStrictEqual(node.position);
        expect(quat).toStrictEqual(node.rotationQuaternion);
        expect(scale).toEqual(node.scaling.x);
        expect(flags).toEqual(ItemDataFlags.NONE);
        expect(tele).toBeNull();
    });

    it('with teleporter data', () => {
        node.teleporterData = {
            type: TeleporterType.Exterior,
            placeId: 2345
        };

        const arr = ItemDataWriter.write(node);
        expect(arr).toHaveLength(18);

        // TODO: parse it.
        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
        expect(pos).toStrictEqual(node.position);
        expect(quat).toStrictEqual(node.rotationQuaternion);
        expect(scale).toEqual(node.scaling.x);
        expect(flags).toEqual(ItemDataFlags.NONE);
        expect(tele).toStrictEqual(node.teleporterData);
    });
});

describe('IItemData that needs float24', () => {
    const node: IItemData = {
        position: new Vector3(0.0, 4223.0, -1500.5),
        scaling: new Vector3(1.5, 1.5, 1.5),
        rotationQuaternion: Quaternion.Identity(),
        disableCollision: false,
        recieveShadows: false,
        teleporterData: null
    };

    it('without teleporter data', () => {
        const arr = ItemDataWriter.write(node);
        expect(arr).toHaveLength(18);

        // TODO: parse it.
        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
        expect(pos).toStrictEqual(node.position);
        expect(quat).toStrictEqual(node.rotationQuaternion);
        expect(scale).toEqual(node.scaling.x);
        expect(flags).toEqual(ItemDataFlags.NONE);
        expect(tele).toBeNull();
    });

    it('with teleporter data', () => {
        node.teleporterData = {
            type: TeleporterType.Exterior,
            placeId: 2345
        };

        const arr = ItemDataWriter.write(node);
        expect(arr).toHaveLength(21);

        // TODO: parse it.
        const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
        expect(pos).toStrictEqual(node.position);
        expect(quat).toStrictEqual(node.rotationQuaternion);
        expect(scale).toEqual(node.scaling.x);
        expect(flags).toEqual(ItemDataFlags.NONE);
        expect(tele).toStrictEqual(node.teleporterData);
    });
});

it('Teleporter to place 0', () => {
    const node: IItemData = {
        position: new Vector3(0.0, 1.0, 1.5),
        scaling: new Vector3(1.5, 1.5, 1.5),
        rotationQuaternion: Quaternion.Identity(),
        disableCollision: false,
        recieveShadows: false,
        teleporterData: null
    };

    node.teleporterData = {
        type: TeleporterType.Exterior,
        placeId: 0
    };

    const arr = ItemDataWriter.write(node);
    expect(arr).toHaveLength(18);

    // TODO: parse it.
    const [quat, pos, scale, flags, tele] = ItemDataParser.parse(toHexString(arr));
    expect(pos).toStrictEqual(node.position);
    expect(quat).toStrictEqual(node.rotationQuaternion);
    expect(scale).toEqual(node.scaling.x);
    expect(flags).toEqual(ItemDataFlags.NONE);
    expect(tele).toStrictEqual(node.teleporterData);
});