import { Document, WebIO } from '@gltf-transform/core';
import { prune, textureResize, dedup, quantize, weld, reorder } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from "meshoptimizer";
const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);


export async function preprocessMesh(buffer: ArrayBuffer, mime_type: string): Promise<Uint8Array> {
    // TODO: preprocess!
    let document: Document;
    const uint8view = new Uint8Array(buffer);
    if (mime_type === "model/gltf-binary") {
        document = await io.readBinary(uint8view);
    } else {
        const textEnc = new TextDecoder("utf-8");
        const json = JSON.parse(textEnc.decode(uint8view));
        document = await io.readJSON({json: json, resources: {}});
    }

    await MeshoptEncoder.ready;

    await document.transform(
        prune(),
        dedup(),
        quantize(),
        weld(),
        //textureResize({size: [512, 512]}),
        reorder({encoder: MeshoptEncoder, target: "performance"})
    );

    return io.writeBinary(document);
}