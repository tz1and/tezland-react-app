import { Document, Logger, Transform, WebIO } from '@gltf-transform/core';
import { prune, dedup, quantize, weld, reorder } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from "meshoptimizer";
import { detectInsideWebworker } from './Utils';
import { Logging } from './Logging';
const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);


export async function preprocessMesh(buffer: ArrayBuffer, mime_type: string): Promise<Uint8Array> {
    if (detectInsideWebworker()) Logging.InfoDev("Processing in webworker");
    
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

    // Build our list of transforms transforms.
    const transforms: Transform[] = [
        prune(),
        dedup(),
        quantize(),
        weld()
    ];

    // If meshoptimizer is supported.
    if (MeshoptEncoder.supported) {
        // Make sure it's ready.
        await MeshoptEncoder.ready;
        transforms.push(reorder({encoder: MeshoptEncoder, target: "performance"}));
    }

    document.setLogger(new Logger(Logger.Verbosity.ERROR));
    await document.transform(
        ...transforms
    );

    // Delete all textures
    /*for (const t of document.getRoot().listTextures()) {
        t.dispose();
    }*/

    return io.writeBinary(document);
}