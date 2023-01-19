import { Document, Logger, Transform, WebIO } from '@gltf-transform/core';
import { prune, /*dedup,*/ quantize, weld, reorder, unpartition, resample, textureResize } from '@gltf-transform/functions';
//import { TextureBasisu } from '@gltf-transform/extensions';
//import { encodeWrapper } from '../external/basis_encoder/basis_loader';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptEncoder } from "meshoptimizer";
import { Logging } from './Logging';
import assert from 'assert';
import { isImageFileType } from './Utils';
import { detectInsideWebworker } from '../workers/WorkerUtils';


const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);
const createImageBitmapAvailable = typeof createImageBitmap === "function";

async function resizeImage(buffer: ArrayBuffer, mime_type: string, maxTexRes: number) {
    // TODO: unduplicate image resizing code!
    const res = await createImageBitmap(new Blob([buffer])); // {resizeWidth: width, resizeHeight: height, resizeQuality: "medium"}

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
    }

    //Logging.InfoDev("old", res.width, res.height);
    //Logging.InfoDev("new", newWidth, newHeight);

    const canvas: any = new OffscreenCanvas(newWidth, newHeight);
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    assert(context);
    context.drawImage(res, 0, 0, newWidth, newHeight);

    const blob: Blob = await canvas.convertToBlob({type: mime_type});
    const newImageBuffer = new Uint8Array(await blob.arrayBuffer());
    res.close();

    return newImageBuffer;
}

/*import { Buffer } from "buffer";
export async function preprocessMeshBase64(buffer: string, mime_type: string, maxTexRes: number): Promise<string> {
    const uint8view = new Uint8Array(Buffer.from(buffer, 'base64'));
    const res = await preprocessMesh(uint8view, mime_type, maxTexRes);
    return Buffer.from(res).toString('base64');
}*/

export async function preprocessMesh(buffer: ArrayBuffer, mime_type: string, maxTexRes: number): Promise<Uint8Array> {
    //if (detectInsideWebworker()) Logging.InfoDev("Processing in webworker");

    if(isImageFileType(mime_type)) {
        return resizeImage(buffer, mime_type, maxTexRes);
    }

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

    if (detectInsideWebworker() && !createImageBitmapAvailable) Logging.Warn("createImageBitmapAvailable not available in webworker");

    if (!createImageBitmapAvailable) transforms.push(textureResize({size: [maxTexRes, maxTexRes]}));

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
    if (createImageBitmapAvailable) {
        for (const t of document.getRoot().listTextures()) {
            // Try to resize image.
            //{
            const texMimeType = t.getMimeType();
            const image = t.getImage();
        
            if (image && (texMimeType === "image/jpeg" || texMimeType === "image/png")) {
                try {
                    t.setImage(await resizeImage(image, t.getMimeType(), maxTexRes));
                }
                catch(e: any) {
                    Logging.Warn("Failed to resize texture: " + t.getName(), e);
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
    }

    return io.writeBinary(document);
}


// NOTES
/*import { Engine, NullEngine, Scene, SceneLoader, SceneSerializer } from '@babylonjs/core';
import "@babylonjs/core/Loading";
import "@babylonjs/loaders";
import "@babylonjs/loaders/glTF";
import { GLTFFileLoader } from '@babylonjs/loaders';

GLTFFileLoader.IncrementalLoading = false;

const offscreen = new OffscreenCanvas(512, 512);
const nullEngine = new NullEngine();
// Set max texture res
const caps = nullEngine.getCaps();
caps.maxTextureSize = Math.min(caps.maxTextureSize, 128);
    
    try {
    const dummyScene = new Scene(nullEngine);

    // LoadAssetContainer?
    const resultTemp = await SceneLoader.LoadAssetContainerAsync("test.glb", new File([binary], "test.glb"), dummyScene, null, ".glb");
    resultTemp.addAllToScene();

    const serialised = JSON.stringify(await SceneSerializer.SerializeAsync(dummyScene));

    const blob = new File([serialised], "test.babylon", { type: "octet/stream" });

    dummyScene.dispose();
    nullEngine.dispose();

    return new Uint8Array(await blob.arrayBuffer());
    }
    catch(e) {
        console.log(e)
        throw e;
    }*/