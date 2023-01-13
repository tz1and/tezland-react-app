import { Document, Logger, Transform, WebIO } from '@gltf-transform/core';
import { prune, /*dedup,*/ quantize, weld, reorder, unpartition, resample } from '@gltf-transform/functions';
//import { TextureBasisu } from '@gltf-transform/extensions';
//import { encodeWrapper } from '../external/basis_encoder/basis_loader';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from "meshoptimizer";
import { Logging } from './Logging';
import assert from 'assert';
const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);


export async function preprocessMesh(buffer: ArrayBuffer, mime_type: string, maxTexRes: number): Promise<Uint8Array> {
    //if (detectInsideWebworker()) Logging.InfoDev("Processing in webworker");

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
        resample(),
        weld({ tolerance: 0 }), // NOTE: weld with tolerance > 0 seems broken?
        quantize(),
        //dedup(), // NOTE: dedup broken in latest?
    ];

    // If meshoptimizer is supported.
    if (MeshoptEncoder.supported) {
        // Make sure it's ready.
        await MeshoptEncoder.ready;
        transforms.push(reorder({encoder: MeshoptEncoder, target: "performance"}));
    }

    // If there is more than one buffer, unpartition so we can save as .glb.
    if (document.getRoot().listBuffers().length > 1) {
        transforms.push(unpartition());
    }

    //if (!isDev())
        document.setLogger(new Logger(Logger.Verbosity.ERROR));
    await document.transform(
        ...transforms
    );

    // Remove lights.
    for (const n of document.getRoot().listNodes()) {
        const lightExt = n.getExtension("KHR_lights_punctual");
        if (lightExt) {
            if (n.listChildren().length !== 0) Logging.Error("Light node was not empty");
            n.dispose();
        }
    }

    // Pre-process textures.
    for (const t of document.getRoot().listTextures()) {
        // Try to resize image.
        //{
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

                res.close();
            }
            catch(e: any) {
                Logging.Warn("Failed to resize texture: " + t.getName());
            }
        }
        //}

        // Then try to basisu it.
        // NOTE: disabled for now
        /*{
            const texMimeType = t.getMimeType();
            const image = t.getImage();

            // TODO: convert jpeg to png: texMimeType === "image/jpeg" || 
            if (image && (texMimeType === "image/png")) {
                try {
                    const encoded = await encodeWrapper(image);

                    // Create an Extension attached to the Document.
                    const basisuExtension = document.createExtension(TextureBasisu)
                        .setRequired(true);

                    t.setMimeType('image/ktx2').setImage(encoded);
                }
                catch(e: any) {
                    Logging.Warn("Failed to basisu encode texture: " + t.getName(), e);
                }
            }
        }*/
    }

    return io.writeBinary(document);
}