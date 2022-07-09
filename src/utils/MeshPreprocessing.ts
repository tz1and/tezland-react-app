import { Document, Logger, Transform, WebIO } from '@gltf-transform/core';
import { prune, dedup, quantize, weld, reorder } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from "meshoptimizer";
import { detectInsideWebworker, isDev } from './Utils';
import { Logging } from './Logging';
import assert from 'assert';
const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);


export async function preprocessMesh(buffer: ArrayBuffer, mime_type: string, maxTexRes: number): Promise<Uint8Array> {
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

    //if (!isDev())
        document.setLogger(new Logger(Logger.Verbosity.ERROR));
    await document.transform(
        ...transforms
    );

    for (const t of document.getRoot().listTextures()) {
        const texMimeType = t.getMimeType();
        const image = t.getImage();
        
        if (image && (texMimeType === "image/jpeg" || texMimeType === "image/png")) {
            try {
                // TODD: use high or pixelated resize quality, depending on sampler.
                const res = await createImageBitmap(new Blob([image])); // {resizeWidth: width, resizeHeight: height, resizeQuality: "medium"}

                // Compute new height < maxTexRes
                let newWidth = res.width;
                let newHeight = res.height;
                if (res.width > maxTexRes || res.height > maxTexRes) {
                    const aspectRatio = res.width / res.height;
                    if (res.width > res.height) {
                        newWidth = maxTexRes;
                        newHeight = Math.floor(maxTexRes / aspectRatio);
                    }
                    else {
                        newHeight = maxTexRes;
                        newWidth = Math.floor(maxTexRes * aspectRatio);
                    }

                    //Logging.InfoDev("old", res.width, res.height);
                    //Logging.InfoDev("new", newWidth, newHeight);
                }

                const canvas: any = new OffscreenCanvas(newWidth, newHeight);
                const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
                assert(context);
                context.drawImage(res, 0, 0, newWidth, newHeight);

                const blob: Blob = await canvas.convertToBlob({type: t.getMimeType()});
                const newImageBuffer = new Uint8Array(await blob.arrayBuffer());

                t.setImage(newImageBuffer);
            }
            catch(e: any) {
                Logging.Warn("Failed to resize texture: " + t.getName());
            }
        }
    }

    return io.writeBinary(document);
}