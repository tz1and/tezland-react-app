import { AssetContainer, Material, MultiMaterial, Nullable, PBRMaterial, Scene, SceneLoader, StandardMaterial, Vector3 } from "@babylonjs/core";
import PQueue from "p-queue";
import { Logging } from "./Logging";
import { FileWithMetadata } from "./Utils";

class ArtifactProcessingQueue {
    private processArtifactTasks: PQueue;
    //private pendingArtifactProcessings: Map<string, Promise<AssetContainer>>;

    constructor() {
        this.processArtifactTasks = new PQueue({concurrency: 1, interval: 1/60, intervalCap: 1});
        //this.pendingArtifactProcessings = new Map();
    }

    public dispose() {
        this.processArtifactTasks.clear();
        //this.pendingArtifactProcessings.clear();
    }

    public queueProcessArtifact(download: FileWithMetadata, scene: Scene): Promise<AssetContainer> {
        // If this download is already pending, return that promise;
        /*const pending = this.pendingArtifactProcessings.get(download.file.name);
        if (pending) {
            // TODO: probably don't need the pending map. This will never happen.
            Logging.WarnDev("returning pending artifact processing");
            return pending;
        }*/
    
        const parsePromiseTask = () => this.processArtifact(download, scene)/*.finally(() => {
            this.pendingArtifactProcessings.delete(download.file.name);
        })*/;
    
        const parsePromise = this.processArtifactTasks.add(parsePromiseTask);
        //this.pendingArtifactProcessings.set(download.file.name, parsePromise);
        return parsePromise;
    }
    
    private async processArtifact(download: FileWithMetadata, scene: Scene): Promise<AssetContainer> {
        let plugin_ext;
        if (download.file.type === "model/gltf-binary")
            plugin_ext = ".glb";
        else if (download.file.type === "model/gltf+json")
            plugin_ext = ".gltf";
        else throw new Error("Unsupported mimeType");
    
        // LoadAssetContainer?
        const result = await SceneLoader.LoadAssetContainerAsync(download.file.name, download.file, scene, null, plugin_ext);
    
        // remove all lights and cameras.
        while (result.lights.length) result.lights[0].dispose();
        while (result.cameras.length) result.cameras[0].dispose();
    
        ArtifactProcessingQueue.removeRefraction(result.materials);
    
        // Enabled collision on all meshes.
        result.meshes.forEach((m) => {
            m.checkCollisions = true;
            // needed? maybe decide based on polycount!
            //m.useOctreeForCollisions = true;
            //m.useOctreeForPicking = true;
            //m.useOctreeForRenderingSelection = true;
        })
        // Make sure to stop all animations.
        result.animationGroups.forEach((ag) => { ag.stop(); })
    
        // Normalise scale to base scale (1m by default).
        // NOTE: use result.meshes[0] instead of transformNodes
        // NOTE: could use normalizeToUnitCube, but that doesn't let us scale freely.
        const baseScale = download.metadata.baseScale; // in m
        const {min, max} = result.meshes[0].getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);
        const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);
        const new_scale = baseScale / extent_max; // Scale to 1 meters, the default.
        result.meshes[0].scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));
    
        return result;
    }

    static removeRefraction(materials: Nullable<Material>[]) {
        materials.forEach((m) => {
            if(m) {
                if (m instanceof PBRMaterial) {
                    //m.transparencyMode = 0;
                    //mat.subSurface.linkRefractionWithTransparency = false;
                    m.subSurface.isRefractionEnabled = false;
                    m.subSurface.isScatteringEnabled = false;
                    m.subSurface.isTranslucencyEnabled = false;
                } else if (m instanceof StandardMaterial) {
                    if (m.refractionTexture) {
                        m.refractionTexture.dispose();
                        m.refractionTexture = null;
                        Logging.InfoDev("removing refraction from", m.name);
                    }
                    if (m.opacityTexture) {
                        m.opacityTexture.dispose();
                        m.opacityTexture = null;
                        Logging.InfoDev("removing opacity from", m.name);
                    }
                    /*if (mat.reflectionTexture) {
                        mat.reflectionTexture.dispose();
                        mat.reflectionTexture = null;
                    }*/
                    // remove relfection texture?
                    //pbr.reflectionTexture = null;
                } else if (m instanceof MultiMaterial) {
                    if(m.subMaterials)
                        ArtifactProcessingQueue.removeRefraction(m.subMaterials);
                }
    
                /*if (m.getRenderTargetTextures)
                m.getRenderTargetTextures().forEach((rtt: RenderTargetTexture) => {
                    rtt.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
                    console.log("set rtt refresh")
                });*/
            }
        });
    };
}

export default new ArtifactProcessingQueue()