import { AssetContainer, Nullable, Scene, SceneLoader, TransformNode } from "@babylonjs/core";
import BigNumber from "bignumber.js";
import ItemNode from "../world/ItemNode";
import ArtifactProcessingQueue from "./ArtifactProcessingQueue";
import { ArtifactDownloadWorkerApi } from "../workers/ArtifactDownload.worker";
import AppSettings from "../storage/AppSettings";
import { ModuleThread, spawn, Thread } from "threads"
import { Logging } from "./Logging";
import assert from "assert";
import { getFileType } from "./Utils";
import { ItemTokenMetadata } from "../world/Metadata";
//import { Logging } from "./Logging";


class ArtifactMemCache {
    private artifactCache: Map<number, Promise<AssetContainer>>;
    private workerThread?: ModuleThread<typeof ArtifactDownloadWorkerApi>;

    /**
     * This is checked by world to know when it needs to do some cleanup.
     */
    public itemsLoaded: boolean = false;

    constructor() {
        this.artifactCache = new Map();
    }

    public async initialise() {
        this.workerThread = await spawn<typeof ArtifactDownloadWorkerApi>(new Worker(new URL("../workers/ArtifactDownload.worker.ts", import.meta.url), { name: "ArtifactDownload.worker" }));
        await this.workerThread.initialise();
    }

    public dispose() {
        ArtifactProcessingQueue.dispose();

        this.artifactCache.forEach(v => {
            v.then(res => res.dispose());
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
                let hasInstances = false;
                for (const m of res.meshes) {
                    if (m.hasInstances) {
                        hasInstances = true;
                        break;
                    }
                }

                // If it doesn't, delete asset and cache entry.
                if (!hasInstances) {
                    Logging.InfoDev("Grabage collecting", k);
                    res.dispose();
                    this.artifactCache.delete(k);
                }
            });
        });
    }

    public async loadFromFile(file: File, token_id: BigNumber, scene: Scene, parent: ItemNode): Promise<Nullable<TransformNode>> {
        const token_id_number = token_id.toNumber();
        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_id_number);
        if(assetPromise) {
            (await assetPromise).dispose();
            this.artifactCache.delete(token_id_number);
        }

        var mime_type;
        const file_type = await getFileType(file);
        if(file_type === "glb") mime_type = "model/gltf-binary";
        else if(file_type === "gltf") mime_type = "model/gltf+json";
        else throw new Error("Unsupported mimeType");

        const fileWithMimeType = new File([await file.arrayBuffer()], file.name, { type: mime_type });

        // NOTE: this is kinda nasty...
        assetPromise = ArtifactProcessingQueue.queueProcessArtifact({file: fileWithMimeType, metadata: {
            baseScale: 1
        } as ItemTokenMetadata}, scene);

        this.artifactCache.set(token_id_number, assetPromise);

        let asset;
        try {
            asset = await assetPromise;
        } catch(e: any) {
            // If the asset fails to resolve, remove the promise from cache.
            this.artifactCache.delete(token_id_number);
            throw e;
        }

        if (parent.isDisposed()) return null;

        // get the original, untransformed bounding vectors from the asset.
        parent.boundingVectors = asset.meshes[0].getHierarchyBoundingVectors();
    
        // Instantiate.
        // Getting first root node is probably enough.
        // Note: imported glTFs are rotate because of the difference in coordinate systems.
        // Don't flip em.
        // NOTE: when an object is supposed to animate, instancing won't work.
        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = asset.instantiateModelsToScene(undefined, false, { doNotInstantiate: () => false });
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = true; })
        instance.rootNodes[0].name = `item${file.name}_clone`;
        instance.rootNodes[0].parent = parent;

        this.itemsLoaded = true;
    
        return parent;
    }

    public async loadArtifact(token_id: BigNumber, scene: Scene, parent: ItemNode, disableCollisions: boolean): Promise<Nullable<TransformNode>> {
        assert(this.workerThread);

        const token_id_number = token_id.toNumber();
        // check if we have this item in the scene already.
        // Otherwise, download it.
        // NOTE: important: do not await anything between getting and adding the assetPromise to the set.
        let assetPromise = this.artifactCache.get(token_id_number);
        if(!assetPromise) {
            const sizeLimit = AppSettings.fileSizeLimit.value;
            const polygonLimit = AppSettings.triangleLimit.value;
            const maxTexRes = AppSettings.textureRes.value;

            assetPromise = this.workerThread.downloadArtifact(token_id, sizeLimit, polygonLimit, maxTexRes).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, scene));
    
            /*if (this.artifactCache.has(token_id_number)) {
                Logging.ErrorDev("Asset was already loaded!", token_id_number);
            }*/
    
            this.artifactCache.set(token_id_number, assetPromise);
        }
        //else Logging.InfoDev("mesh found in cache");

        let asset;
        try {
            asset = await assetPromise;
        } catch(e: any) {
            // If the asset fails to resolve, remove the promise from cache.
            this.artifactCache.delete(token_id_number);
            throw e;
        }

        // TODO: defer instantiation to do it in batch in beforeRender() or afterRender() in world?
        // Add to a queue and in World, remove from this queue and all all instances while disabling all
        // that stuff it says in that babylonjs doc on optimisation.
        // Can also do some stuff to only load X per frame, maybe.
    
        if (parent.isDisposed()) return null;

        // get the original, untransformed bounding vectors from the asset.
        parent.boundingVectors = asset.meshes[0].getHierarchyBoundingVectors();
    
        // Instantiate.
        // Getting first root node is probably enough.
        // Note: imported glTFs are rotate because of the difference in coordinate systems.
        // Don't flip em.
        // NOTE: when an object is supposed to animate, instancing won't work.
        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = asset.instantiateModelsToScene(undefined, false, { doNotInstantiate: () => false });
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = !disableCollisions; })
        instance.rootNodes[0].name = `item${token_id}_clone`;
        instance.rootNodes[0].parent = parent;

        this.itemsLoaded = true;
    
        return parent;
    }

    public async loadOther(id: number, fileName: string, scene: Scene, parent: TransformNode) {
        let assetPromise = this.artifactCache.get(id);
        if(!assetPromise) {
            // TODO: make sure glb file is pre-processed!
            assetPromise = SceneLoader.LoadAssetContainerAsync('/models/', fileName, scene, null, '.glb');
    
            /*if (this.artifactCache.has(token_id_number)) {
                Logging.ErrorDev("Asset was already loaded!", token_id_number);
            }*/
    
            this.artifactCache.set(id, assetPromise);
        }
        //else Logging.InfoDev("mesh found in cache");

        let asset;
        try {
            asset = await assetPromise;
        } catch(e: any) {
            // If the asset fails to resolve, remove the promise from cache.
            this.artifactCache.delete(id);
            throw e;
        }

        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = asset.instantiateModelsToScene(undefined, false, { doNotInstantiate: () => false });
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = true; })
        instance.rootNodes[0].parent = parent;

        this.itemsLoaded = true;

        return parent;
    }
}

export default new ArtifactMemCache();