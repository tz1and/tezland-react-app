import { AssetContainer, Nullable, Scene, SceneLoader, TransformNode } from "@babylonjs/core";
import ItemNode from "../world/nodes/ItemNode";
import ArtifactProcessingQueue from "./ArtifactProcessingQueue";
import { ArtifactDownloadWorkerApi } from "../workers/ArtifactDownload.worker";
import AppSettings from "../storage/AppSettings";
import { ModuleThread, spawn, Thread } from "threads"
import { Logging } from "./Logging";
import assert from "assert";
import { getFileType } from "./Utils";
import { ItemTokenMetadata } from "../world/Metadata";
import { Game } from "../world/Game";
import TokenKey from "./TokenKey";
import RefCounted from "./RefCounted";
//import { Logging } from "./Logging";


export const instantiateOptions: {
    doNotInstantiate?: boolean | ((node: TransformNode) => boolean);
    predicate?: (entity: any) => boolean;
} = {
    doNotInstantiate: false/*,
    predicate: (entity) => {
        if (entity instanceof TransformNode && entity.name === "__root__") return true;
        if (entity instanceof Mesh && (!entity.geometry || entity.geometry.getTotalVertices() === 0)) return false;
        if (entity instanceof InstancedMesh && entity.subMeshes.length === 0) return false;
        return true;
    }*/
}


class ArtifactMemCache {
    private artifactCache: Map<string, Promise<RefCounted<AssetContainer>>>;
    private workerThread?: ModuleThread<typeof ArtifactDownloadWorkerApi>;

    /**
     * This is checked by world to know when it needs to do some cleanup.
     */
    public itemsLoaded: boolean = false;

    constructor() {
        this.artifactCache = new Map();
    }

    public async initialise() {
        this.workerThread = await spawn<typeof ArtifactDownloadWorkerApi>(new Worker(
            new URL("../workers/ArtifactDownload.worker.ts", import.meta.url),
            { type: 'module', name: "ArtifactDownload.worker" }));
        await this.workerThread.initialise();
    }

    public dispose() {
        ArtifactProcessingQueue.dispose();

        this.artifactCache.forEach(v => {
            v.then(res => res.object.dispose());
        })
        this.artifactCache.clear();

        if (this.workerThread) {
            this.workerThread.shutdown().then(() => {
                Thread.terminate(this.workerThread!).then(() => {
                    Logging.InfoDev("Thread terminated: ArtifactDownload.worker");
                });
            });
        }
    }

    public cleanup() {
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
            if(file_type === "glb") mime_type = "model/gltf-binary";
            else if(file_type === "gltf") mime_type = "model/gltf+json";
            else throw new Error("Unsupported mimeType");

            const fileWithMimeType = new File([await file.arrayBuffer()], file.name, { type: mime_type });

            // NOTE: this is kinda nasty...
            return ArtifactProcessingQueue.queueProcessArtifact({file: fileWithMimeType, metadata: {
                baseScale: 1
            } as ItemTokenMetadata}, scene);
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

        // get the original, untransformed bounding vectors from the asset.
        parent.boundingVectors = asset?.object.meshes[0].getHierarchyBoundingVectors();
    
        // Instantiate.
        // Getting first root node is probably enough.
        // Note: imported glTFs are rotate because of the difference in coordinate systems.
        // Don't flip em.
        // NOTE: when an object is supposed to animate, instancing won't work.
        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = asset.object.instantiateModelsToScene(undefined, false, instantiateOptions);
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = true; })
        instance.rootNodes[0].name = `item${file.name}_clone`;
        instance.rootNodes[0].parent = parent;

        // Increase refcount.
        asset.incRefCount();

        this.itemsLoaded = true;
    
        return parent;
    }

    public async loadArtifact(token_key: TokenKey, game: Game, parent: ItemNode, disableCollisions: boolean, clone: boolean = false): Promise<Nullable<TransformNode>> {
        assert(this.workerThread);

        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_key.toString());
        if(!assetPromise) {
            const limits = game.getWorldLimits();
            const maxTexRes = AppSettings.textureRes.value;

            assetPromise = this.workerThread.downloadArtifact(token_key, limits.fileSizeLimit, limits.triangleLimit, maxTexRes).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, game.scene));
    
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

        // get the original, untransformed bounding vectors from the asset.
        parent.boundingVectors = asset.object.meshes[0].getHierarchyBoundingVectors();
    
        // Instantiate.
        // Getting first root node is probably enough.
        // Note: imported glTFs are rotate because of the difference in coordinate systems.
        // Don't flip em.
        // NOTE: when an object is supposed to animate, instancing won't work.
        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = asset.object.instantiateModelsToScene(undefined, false, {doNotInstantiate: clone});
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = !disableCollisions; })
        instance.rootNodes[0].name = `item${token_key.toString()}_clone`;
        instance.rootNodes[0].parent = parent;

        // Increase refcount.
        asset.incRefCount();

        this.itemsLoaded = true;
    
        return parent;
    }

    public async loadOther(id: number, fileName: string, scene: Scene, parent: TransformNode) {
        const token_key = TokenKey.fromNumber(id, "internalitem");

        let assetPromise = this.artifactCache.get(token_key.toString());
        if(!assetPromise) {
            // TODO: make sure glb file is pre-processed!
            assetPromise = (async () => {
                const res = await SceneLoader.LoadAssetContainerAsync('/models/', fileName, scene, null, '.glb');
                return new RefCounted(res);
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

        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = asset.object.instantiateModelsToScene(undefined, false, instantiateOptions);
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = true; })
        instance.rootNodes[0].parent = parent;

        // Increase refcount.
        asset.incRefCount();

        this.itemsLoaded = true;

        return parent;
    }
}

export default new ArtifactMemCache();