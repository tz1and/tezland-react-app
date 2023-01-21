import { AssetContainer } from '@babylonjs/core/assetContainer';
import { SceneLoader } from '@babylonjs/core/Loading';
import { Material, MultiMaterial, PBRMaterial, StandardMaterial } from '@babylonjs/core/Materials';
import { Vector3 } from '@babylonjs/core/Maths';
import { TransformNode } from '@babylonjs/core/Meshes';
import { Scene } from '@babylonjs/core/scene';
import { Nullable } from '@babylonjs/core/types';
import { GLTFFileLoader } from '@babylonjs/loaders';
import assert from "assert";
import PQueue from "p-queue";
import { AssetContainerExt } from "../world/BabylonUtils";
import { BufferFileWithMetadata } from "../world/Metadata";
import { createFrameForImage } from "./FrameImage";
import { Logging } from "./Logging";
import { isImageFileType } from "./Utils";

GLTFFileLoader.IncrementalLoading = false;

class ArtifactProcessingQueue {
    private processArtifactTasks: PQueue;

    /**
     * Using a modified p-queue to be able to switch the queue between slow
     * and fast processing. Used to optimise for performance when there is
     * user input.
     */
    private _isSlow: boolean = false;
    public set isSlow(slow: boolean) {
        // Only change when state changed.
        if (slow !== this._isSlow) {
            this._isSlow = slow;

            if (this._isSlow) {
                Logging.InfoDev("Setting slow model loading");
                this.processArtifactTasks.intervalCap = 1;
                this.processArtifactTasks.concurrency = 1;
            }
            else {
                Logging.InfoDev("Setting fast model loading");
                this.processArtifactTasks.intervalCap = 10000;
                this.processArtifactTasks.concurrency = 10;
            }
        }
    }

    constructor() {
        // TODO: maybe fine-tune the interval and the slow settings. Leaning towards performance too much right now maybe.
        this.processArtifactTasks = new PQueue({concurrency: 10, interval: 1000, intervalCap: 10000});
    }

    public dispose() {
        this.processArtifactTasks.clear();
        this.isSlow = false;
    }

    public queueProcessArtifact(download: BufferFileWithMetadata, scene: Scene, assetGroup: Nullable<TransformNode>): Promise<AssetContainerExt> {
        const parsePromiseTask = () => this.processArtifact(download, scene, assetGroup);
        return this.processArtifactTasks.add(parsePromiseTask);
    }
    
    private async processArtifact(download: BufferFileWithMetadata, scene: Scene, assetGroup: Nullable<TransformNode>): Promise<AssetContainerExt> {
        const file = new File([download.file.buffer], download.file.name, {type: download.file.type});

        if (isImageFileType(download.file.type)) {
            const assetContainer = new AssetContainer(scene);
            // TODO: get dimensions from metadata or something!
            assert(download.metadata.width !== null && download.metadata.height !== null, "No image resolution in metadata.");
            assert(download.metadata.imageFrameJson, "No image frame in metadata.");
            createFrameForImage(file, {width: download.metadata.width, height: download.metadata.height}, download.metadata.imageFrameJson, scene, assetContainer);

            assetContainer.addAllToScene();

            // Disable collision on all meshes.
            assetContainer.meshes.forEach((m) => {
                m.checkCollisions = false;
                // needed? maybe decide based on polycount!
                //m.useOctreeForCollisions = true;
                //m.useOctreeForPicking = true;
                //m.useOctreeForRenderingSelection = true;
            });

            // Freeze all materials.
            assetContainer.materials.forEach(m => m.freeze());
        
            // Normalise scale to base scale (1m by default).
            // NOTE: use result.meshes[0] instead of transformNodes
            // NOTE: could use normalizeToUnitCube, but that doesn't let us scale freely.
            const baseScale = download.metadata.baseScale; // in m
            const {min, max} = assetContainer.transformNodes[0].getHierarchyBoundingVectors(true);
            const extent = max.subtract(min);
            const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);
            const new_scale = baseScale / extent_max; // Scale to 1 meters, the default.
            assetContainer.transformNodes[0].scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));

            return new AssetContainerExt(assetContainer, assetGroup);
        }
        else {
            let plugin_ext;
            if (download.file.type === "model/gltf-binary")
                plugin_ext = ".glb";
            else if (download.file.type === "model/gltf+json")
                plugin_ext = ".gltf";
            else throw new Error("Unsupported mimeType");

            // LoadAssetContainer?
            const result = await SceneLoader.LoadAssetContainerAsync(download.file.name, file, scene, null, plugin_ext);

            result.addAllToScene();
        
            // remove all lights and cameras.
            while (result.lights.length) result.lights[0].dispose();
            while (result.cameras.length) result.cameras[0].dispose();
        
            ArtifactProcessingQueue.removeRefraction(result.materials);
        
            // Disable collision on all meshes.
            result.meshes.forEach((m) => {
                m.checkCollisions = false;
                // needed? maybe decide based on polycount!
                //m.useOctreeForCollisions = true;
                //m.useOctreeForPicking = true;
                //m.useOctreeForRenderingSelection = true;
            })
            // Make sure to stop all animations.
            result.animationGroups.forEach(ag => ag.stop());

            // Freeze all materials.
            result.materials.forEach(m => m.freeze());
        
            // Normalise scale to base scale (1m by default).
            // NOTE: use result.meshes[0] instead of transformNodes
            // NOTE: could use normalizeToUnitCube, but that doesn't let us scale freely.
            const baseScale = download.metadata.baseScale; // in m
            const {min, max} = result.meshes[0].getHierarchyBoundingVectors(true);
            const extent = max.subtract(min);
            const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);
            const new_scale = baseScale / extent_max; // Scale to 1 meters, the default.
            result.meshes[0].scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));
        
            return new AssetContainerExt(result, assetGroup);
        }
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

const processingQueue = new ArtifactProcessingQueue();
export default processingQueue;