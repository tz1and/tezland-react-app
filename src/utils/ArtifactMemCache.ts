import { Nullable } from "@babylonjs/core/types";
import { TransformNode } from "@babylonjs/core/Meshes";
import { Scene } from "@babylonjs/core/scene";
import ItemNode from "../world/nodes/ItemNode";
import ArtifactDownload from "./ArtifactDownload";
import ArtifactProcessingQueue from "./ArtifactProcessingQueue";
import { ArtifactDownloadWorkerApi } from "../workers/ArtifactDownload.worker";
import AppSettings from "../storage/AppSettings";
import { ModuleThread, spawn } from "threads"
import { Logging } from "./Logging";
import { getFileType, isImageFileType } from "./Utils";
import { BufferFile, ItemTokenMetadata } from "../world/Metadata";
import { Game } from "../world/Game";
import TokenKey from "./TokenKey";
import { defaultFrameParams } from "./FrameImage";
import { AssetContainerExt } from "../world/BabylonUtils";
//import { Logging } from "./Logging";


class ArtifactMemCache {
    private artifactCache: Map<string, Promise<AssetContainerExt>>;
    private _workerThread: ModuleThread<typeof ArtifactDownloadWorkerApi> | null = null;
    private initialised: boolean;

    public get workerThread(): ModuleThread<typeof ArtifactDownloadWorkerApi> | null { return this._workerThread; };

    //private assetGroup: Nullable<TransformNode> = null;

    /**
     * This is checked by world to know when it needs to do some cleanup.
     */
    public itemsLoaded: boolean = false;

    constructor() {
        this.artifactCache = new Map();
        this.initialised = false;
    }

    public async initialise() {
        if(this.initialised) {
            Logging.WarnDev("ArtifactMemCache was already initialised");
            return;
        }

        this.initialised = true;

        try {
            this._workerThread = await spawn<typeof ArtifactDownloadWorkerApi>(
                new Worker(new URL("../workers/ArtifactDownload.worker.ts", import.meta.url),
                    { type: 'module', name: "ArtifactDownload.worker" }), {
                        timeout: 20000
                    });
            await this._workerThread.initialise();
        }
        catch(e) {
            Logging.Error("Failed to spawn worker thread:", e);
            this._workerThread = null;
        }

        //this.assetGroup = assetGroup;
    }

    public async dispose() {
        // Don't kill the worker for now.
        /*if (this._workerThread) {
            await this._workerThread.shutdown();
            try {
                await Thread.terminate(this._workerThread);
                Logging.InfoDev("Thread terminated: ArtifactDownload.worker");
            } catch(e) {
                Logging.ErrorDev("Thread failed to terminate: ArtifactDownload.worker:", e);
            }
            this._workerThread = null;
        }*/

        ArtifactProcessingQueue.dispose();

        this.artifactCache.forEach(v => {
            v.then(res => res.dispose());
        })
        this.artifactCache.clear();

        //this.assetGroup = null;
    }

    public cleanup() {
        Logging.Info("Running asset cleanup");
        // For all assets in the cache
        this.artifactCache.forEach((v, k) => {
            v.then(res => {
                // Figure out if it has instances in the scene.
                let isReferenced = res.refcount > 0;

                // If it doesn't, delete asset and cache entry.
                if (!isReferenced) {
                    Logging.InfoDev("Grabage collecting", k);
                    res.dispose();
                    this.artifactCache.delete(k);
                }
            });
        });
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

    public async loadFromFile(file: File, token_key: TokenKey, scene: Scene, parent: ItemNode, assetGroup: Nullable<TransformNode>): Promise<Nullable<TransformNode>> {
        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_key.toString());
        if(assetPromise) {
            (await assetPromise).dispose();
            this.artifactCache.delete(token_key.toString());
        }

        // So we don't directly await anything between.
        assetPromise = (async () => {
            // TODO: add ArtifactDownload.processModel
            var mime_type;
            const file_type = await getFileType(file);
            // TODO: have a getMimeType
            if(file_type === "glb") mime_type = "model/gltf-binary";
            else if(file_type === "gltf") mime_type = "model/gltf+json";
            else if(file_type === "png") mime_type = "image/png";
            else if(file_type === "jpg" || file_type === "jpeg") mime_type = "image/jpeg";
            else throw new Error("Unsupported mimeType");

            const bufferFile: BufferFile = { buffer: await file.arrayBuffer(), name: file.name, type: mime_type };

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
            } as ItemTokenMetadata}, scene, assetGroup);
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

        asset.instantiate(parent, `item${file.name}_clone`, parent.boundingVectors);
    
        return parent;
    }

    public async loadArtifact(token_key: TokenKey, game: Game, parent: ItemNode, assetGroup: Nullable<TransformNode>, clone: boolean = false): Promise<Nullable<TransformNode>> {
        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_key.toString());
        if(!assetPromise) {
            const limits = game.getWorldLimits();
            const maxTexRes = AppSettings.textureRes.value;

            const downloadFunc = this._workerThread ? this._workerThread.downloadArtifact : ArtifactDownload.downloadArtifact;
            assetPromise = downloadFunc(token_key, limits.fileSizeLimit, limits.triangleLimit, maxTexRes).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, game.scene, assetGroup));
    
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

        asset.instantiate(parent, `item${token_key.toString()}_clone`, parent.boundingVectors, clone);

        // Set itemsLoaded flag.
        this.itemsLoaded = true;
    
        return parent;
    }

    public async loadOther(id: number, fileName: string, scene: Scene, parent: TransformNode, assetGroup: Nullable<TransformNode>) {
        const token_key = TokenKey.fromNumber(id, "internalitem");

        let assetPromise = this.artifactCache.get(token_key.toString());
        if(!assetPromise) {
            const maxTexRes = AppSettings.textureRes.value;

            const downloadFunc = this._workerThread ? this._workerThread.downloadModel : ArtifactDownload.downloadModel;
            assetPromise = downloadFunc('/models/', fileName, maxTexRes).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, scene, assetGroup));
    
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

        const instanceRoot = asset.instantiate(parent, `item${fileName}_clone`);
        instanceRoot.getChildMeshes().forEach((m) => { m.checkCollisions = true; });

        // Set itemsLoaded flag.
        this.itemsLoaded = true;

        return parent;
    }
}

const memCache = new ArtifactMemCache();
export default memCache;