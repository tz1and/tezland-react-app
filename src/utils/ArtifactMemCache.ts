import { Nullable, Scene, SceneLoader, TransformNode } from "@babylonjs/core";
import ItemNode from "../world/nodes/ItemNode";
import ArtifactProcessingQueue from "./ArtifactProcessingQueue";
import { ArtifactDownloadWorkerApi } from "../workers/ArtifactDownload.worker";
import AppSettings from "../storage/AppSettings";
import { ModuleThread, spawn, Thread } from "threads"
import { Logging } from "./Logging";
import assert from "assert";
import { getFileType, isImageFileType } from "./Utils";
import { BufferFile, ItemTokenMetadata } from "../world/Metadata";
import { Game } from "../world/Game";
import TokenKey from "./TokenKey";
import RefCounted from "./RefCounted";
import { defaultFrameParams } from "./FrameImage";
import { AssetContainerExt, BoundingVectors } from "../world/BabylonUtils";
//import { Logging } from "./Logging";


class ArtifactMemCache {
    private artifactCache: Map<string, Promise<RefCounted<AssetContainerExt>>>;
    private workerThread: ModuleThread<typeof ArtifactDownloadWorkerApi> | null = null;

    private assetGroup: Nullable<TransformNode> = null;

    /**
     * This is checked by world to know when it needs to do some cleanup.
     */
    public itemsLoaded: boolean = false;

    constructor() {
        this.artifactCache = new Map();
    }

    public async initialise(assetGroup: Nullable<TransformNode>, spawnWorker: boolean = true) {
        if(spawnWorker) {
            this.workerThread = await spawn<typeof ArtifactDownloadWorkerApi>(
                new Worker(new URL("../workers/ArtifactDownload.worker.ts", import.meta.url),
                    { type: 'module', name: "ArtifactDownload.worker" }));
            await this.workerThread.initialise();
        }
        else {
            assert(this.workerThread === null, "workerThread was not null on init")
        }

        this.assetGroup = assetGroup;
    }

    public async dispose() {
        if (this.workerThread) {
            await this.workerThread.shutdown();
            try {
                await Thread.terminate(this.workerThread);
                Logging.InfoDev("Thread terminated: ArtifactDownload.worker");
            } catch(e) {
                Logging.ErrorDev("Thread failed to terminate: ArtifactDownload.worker:", e);
            }
            this.workerThread = null;
        }

        ArtifactProcessingQueue.dispose();

        this.artifactCache.forEach(v => {
            v.then(res => res.object.dispose());
        })
        this.artifactCache.clear();

        this.assetGroup = null;
    }

    public cleanup(scene: Scene) {
        // https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#scene-with-large-number-of-meshes
        scene.blockfreeActiveMeshesAndRenderingGroups = true;

        // For all assets in the cache
        this.artifactCache.forEach((v, k) => {
            v.then(res => {
                // Figure out if it has instances in the scene.
                let isReferenced = res.refcount > 0;

                // If it doesn't, delete asset and cache entry.
                if (!isReferenced) {
                    Logging.InfoDev("Grabage collecting", k);
                    res.object.dispose();
                    this.artifactCache.delete(k);
                }
            });
        });

        scene.blockfreeActiveMeshesAndRenderingGroups = false;
    }

    /**
     * Really only needed because ItemNode does not reference the loaded asset.
     * Could make ItemNode hang on tho the asset container and remove this function.
     * @param token_key the asset key.
     */
    public decAssetRefCount(token_key: TokenKey) {
        this.artifactCache.get(token_key.toString())?.then(res => {
            res.decRefCount();
        });
    }

    public async loadFromFile(file: File, token_key: TokenKey, scene: Scene, parent: ItemNode): Promise<Nullable<TransformNode>> {
        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_key.toString());
        if(assetPromise) {
            (await assetPromise).object.dispose();
            this.artifactCache.delete(token_key.toString());
        }

        // So we don't directly await anything between.
        assetPromise = (async () => {
            var mime_type;
            const file_type = await getFileType(file);
            // TODO: have a getMimeType
            if(file_type === "glb") mime_type = "model/gltf-binary";
            else if(file_type === "gltf") mime_type = "model/gltf+json";
            else if(file_type === "png") mime_type = "image/png";
            else if(file_type === "jpg" || file_type === "jpeg") mime_type = "image/jpeg";
            else throw new Error("Unsupported mimeType");

            const bufferFile = {buffer: await file.arrayBuffer(), name: file.name, type: mime_type } as BufferFile;

            let resolution;
            if (isImageFileType(mime_type)) {
                const res = await createImageBitmap(file);
                resolution = {
                    width: res.width, height: res.height,
                    imageFrameJson: defaultFrameParams
                }
                res.close();
            }

            // NOTE: this is kinda nasty...
            return ArtifactProcessingQueue.queueProcessArtifact({file: bufferFile, metadata: {
                baseScale: 1, ...resolution
            } as ItemTokenMetadata}, scene, this.assetGroup);
        })()

        this.artifactCache.set(token_key.toString(), assetPromise);

        let asset;
        try {
            asset = await assetPromise;
        } catch(e: any) {
            // If the asset fails to resolve, remove the promise from cache.
            this.artifactCache.delete(token_key.toString());
            throw e;
        }

        if (parent.isDisposed()) return null;

        const instanceRoot = this.instantiateCachedAssetContainer(asset, parent, `item${file.name}_clone`, parent.boundingVectors);
        instanceRoot.getChildMeshes().forEach((m) => { m.checkCollisions = true; });
    
        return parent;
    }

    public async loadArtifact(token_key: TokenKey, game: Game, parent: ItemNode, clone: boolean = false): Promise<Nullable<TransformNode>> {
        assert(this.workerThread);

        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_key.toString());
        if(!assetPromise) {
            const limits = game.getWorldLimits();
            const maxTexRes = AppSettings.textureRes.value;

            assetPromise = this.workerThread.downloadArtifact(token_key, limits.fileSizeLimit, limits.triangleLimit, maxTexRes).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, game.scene, this.assetGroup));
    
            /*if (this.artifactCache.has(token_id_number)) {
                Logging.ErrorDev("Asset was already loaded!", token_id_number);
            }*/

            this.artifactCache.set(token_key.toString(), assetPromise);
        }
        //else Logging.InfoDev("mesh found in cache");

        let asset;
        try {
            asset = await assetPromise;
        } catch(e: any) {
            // If the asset fails to resolve, remove the promise from cache.
            this.artifactCache.delete(token_key.toString());
            throw e;
        }

        // TODO: defer instantiation to do it in batch in beforeRender() or afterRender() in world?
        // Add to a queue and in World, remove from this queue and all all instances while disabling all
        // that stuff it says in that babylonjs doc on optimisation.
        // Can also do some stuff to only load X per frame, maybe.
    
        if (parent.isDisposed()) return null;

        this.instantiateCachedAssetContainer(asset, parent, `item${token_key.toString()}_clone`, parent.boundingVectors, clone);
    
        return parent;
    }

    public async loadOther(id: number, fileName: string, scene: Scene, parent: TransformNode) {
        const token_key = TokenKey.fromNumber(id, "internalitem");

        let assetPromise = this.artifactCache.get(token_key.toString());
        if(!assetPromise) {
            // TODO: make sure glb file is pre-processed!
            assetPromise = (async () => {
                const res = await SceneLoader.LoadAssetContainerAsync('/models/', fileName, scene, null, '.glb');
                res.addAllToScene();
                return new RefCounted(new AssetContainerExt(res, this.assetGroup));
                // Enable this, but figure out why booths are darker sometimes.
                // Probably to do with reflection probe, RTTs not updating or something.
                // Maybe related to freeze active meshes?
                /*const response = await fetch('/models/' + fileName);
                const fileWithMimeType = new File([await response.arrayBuffer()], fileName, { type: "model/gltf-binary" });

                return ArtifactProcessingQueue.queueProcessArtifact({file: fileWithMimeType, metadata: {
                    baseScale: 1
                } as ItemTokenMetadata}, scene);*/
            })()
    
            /*if (this.artifactCache.has(token_id_number)) {
                Logging.ErrorDev("Asset was already loaded!", token_id_number);
            }*/
    
            this.artifactCache.set(token_key.toString(), assetPromise);
        }
        //else Logging.InfoDev("mesh found in cache");

        let asset;
        try {
            asset = await assetPromise;
        } catch(e: any) {
            // If the asset fails to resolve, remove the promise from cache.
            this.artifactCache.delete(token_key.toString());
            throw e;
        }

        const instanceRoot = this.instantiateCachedAssetContainer(asset, parent, `item${fileName}_clone`);
        instanceRoot.getChildMeshes().forEach((m) => { m.checkCollisions = true; });

        return parent;
    }

    private instantiateCachedAssetContainer(asset: RefCounted<AssetContainerExt>, parent: ItemNode | TransformNode, name: string,
        boundingVectorsOut: Nullable<BoundingVectors> = null, clone: boolean = false): TransformNode
    {
        const instanceRoot = asset.object.instantiate(parent, name, boundingVectorsOut, clone);

        // Increase refcount.
        asset.incRefCount();

        // Set itemsLoaded flag.
        this.itemsLoaded = true;

        return instanceRoot;
    }
}

const memCache = new ArtifactMemCache();
export default memCache;