import { BoundingBox } from "@babylonjs/core";

// TODO: probably should be in some other file...
// returns true if the first box fully contains the second.
export const containsBox = ( first: BoundingBox, box: BoundingBox ) => {
    return first.minimumWorld.x <= box.minimumWorld.x && box.maximumWorld.x <= first.maximumWorld.x &&
        first.minimumWorld.y <= box.minimumWorld.y && box.maximumWorld.y <= first.maximumWorld.y &&
        first.minimumWorld.z <= box.minimumWorld.z && box.maximumWorld.z <= first.maximumWorld.z;
}

export const toHexString = (bytes: Uint8Array) => bytes.reduce((str: String, byte: Number) => str + byte.toString(16).padStart(2, '0'), '');