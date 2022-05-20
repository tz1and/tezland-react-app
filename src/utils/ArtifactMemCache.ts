import { AssetContainer, Nullable, Scene, TransformNode } from "@babylonjs/core";
import BigNumber from "bignumber.js";
import ItemNode from "../world/ItemNode";
import ArtifactDownloadQueue from "./ArtifactDownload";
import ArtifactProcessingQueue from "./ArtifactProcessingQueue";
import { Logging } from "./Logging";
//import { Logging } from "./Logging";

class ArtifactMemCache {
    private artifactCache: Map<number, Promise<AssetContainer>>;

    constructor() {
        this.artifactCache = new Map();
    }

    public dispose() {
        ArtifactProcessingQueue.dispose();

        this.artifactCache.forEach(v => {
            v.then(res => res.dispose());
        })
        this.artifactCache.clear();
    }

    public async loadArtifact(token_id: BigNumber, scene: Scene, parent: ItemNode): Promise<Nullable<TransformNode>> {
        const token_id_number = token_id.toNumber();
        // check if we have this item in the scene already.
        // Otherwise, download it.
        let assetPromise = this.artifactCache.get(token_id_number);
        if(!assetPromise) {
            assetPromise = ArtifactDownloadQueue.downloadArtifact(token_id).then(res => ArtifactProcessingQueue.queueProcessArtifact(res, scene));
    
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
            // NOTE: temp workaround for bullshit nodes returning bullshit data.
            // This should probably be a catch and rethrow on queueProcessArtifact.
            Logging.Warn("Deleting failed download from artifcat cache.", token_id_number);
            await ArtifactDownloadQueue.deleteFromDBCache(token_id);
            this.artifactCache.delete(token_id_number);
            throw e;
        }
    
        if (parent.isDisposed()) return null;
    
        // Instantiate.
        // Getting first root node is probably enough.
        // Note: imported glTFs are rotate because of the difference in coordinate systems.
        // Don't flip em.
        // NOTE: when an object is supposed to animate, instancing won't work.
        const instance = asset.instantiateModelsToScene(undefined, false, { doNotInstantiate: false });
        instance.rootNodes[0].getChildMeshes().forEach((m) => { m.checkCollisions = true; })
        instance.rootNodes[0].name = `item${token_id}_clone`;
        instance.rootNodes[0].parent = parent;
    
        return parent;
    }
}

export default new ArtifactMemCache();