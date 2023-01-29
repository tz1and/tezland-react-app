import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Engine, EngineOptions, WebGPUEngine, WebGPUEngineOptions } from "@babylonjs/core/Engines";
import { Vector3 } from "@babylonjs/core/Maths";
import { TransformNode } from "@babylonjs/core/Meshes";
import { Nullable } from "@babylonjs/core/types";
import { Node } from "@babylonjs/core/node";
import AppSettings from "../storage/AppSettings";
import RefCounted from "../utils/RefCounted";
import { assert } from "../utils/Assert";


namespace BabylonUtils {
    function isWebGL2Supported() {
        return !!document.createElement('canvas').getContext('webgl2');
    }

    export async function createEngine(canvas: HTMLCanvasElement) {
        let engine: Engine;
        const webGPUSupported = await WebGPUEngine.IsSupportedAsync;

        if (false && webGPUSupported) {
            const options: WebGPUEngineOptions = {
                audioEngine: false,
                antialiasing: AppSettings.enableAntialiasing.value,
                powerPreference: "high-performance",
                stencil: true,
                doNotHandleContextLost: true};

            const webGpuEngine = new WebGPUEngine(canvas, options);
            await webGpuEngine.initAsync();
            engine = webGpuEngine;
        }
        else {
            if (!isWebGL2Supported()) throw new Error("WebGL 2 not support");

            const options: EngineOptions = {
                audioEngine: false,
                powerPreference: "high-performance",
                preserveDrawingBuffer: true,
                stencil: true,
                doNotHandleContextLost: true,
                useHighPrecisionFloats: AppSettings.highPrecisionShaders.value,
                useHighPrecisionMatrix: AppSettings.highPrecisionShaders.value,
                failIfMajorPerformanceCaveat: true};

            engine = new Engine(canvas, AppSettings.enableAntialiasing.value, options);
        }

        engine.disableManifestCheck = true;
        return engine;
    }

    export function getAssetRoot(asset: AssetContainer): Node {
        if (asset.rootNodes.length > 0) {
            return asset.rootNodes[0];
        } else {
            return asset.meshes[0];
        }
    }
}

export default BabylonUtils;


export type BoundingVectors = {
    min: Vector3;
    max: Vector3;
}

const instantiateOptions = (clone: boolean = false): {
    doNotInstantiate?: boolean | ((node: TransformNode) => boolean);
    predicate?: (entity: any) => boolean;
} => {
    return {
        /**
         * Note that by default instantiateModelsToScene will always clone
         * meshes if they have a skeleton, even if you set doNotInstantiate = false.
         * If you want to force instanciation in this case, you should pass
         * () => false for doNotInstantiate.
         */
        doNotInstantiate: clone ? true : () => false
        /*predicate: (entity) => {
            if (entity instanceof TransformNode && entity.name === "__root__") return true;
            if (entity instanceof Mesh && (!entity.geometry || entity.geometry.getTotalVertices() === 0)) return false;
            if (entity instanceof InstancedMesh && entity.subMeshes.length === 0) return false;
            return true;
        }*/
    }
}

// TODO: InstantiatedEntried now has a dispose() function. We could hold on to these to make sure instances
// are properly disposed of. InstanceExt could hang on to AssetContainerExt and handle refernce count stuff
// on dispose.
export class AssetContainerExt extends RefCounted {
    constructor(readonly container: AssetContainer, readonly assetGroup: Nullable<TransformNode>) {
        super();
        BabylonUtils.getAssetRoot(container).parent = assetGroup;
    }

    /**
     * Instantiates an models in an AssetContainer.
     * @param parent the node the new instance/clone is parented to
     * @param name the name of the instances root node
     * @param boundingVectorsOut if not null, bounding vectors are copied to this ref
     * @param clone if false, an instance will be created
     * @returns the instance root node
     */
    public instantiate(parent: Nullable<TransformNode>, name: string,
        boundingVectorsOut: Nullable<BoundingVectors> = null, clone: boolean = false): TransformNode
    {
        // If we want loaded assets to not all be in the root we need to:
        // https://forum.babylonjs.com/t/proper-way-to-create-an-instance-of-a-loaded-glb/37478/15?u=852kerfunkle
        // Assign them to a new root and before calling instantiateModelsToScene assign them to null again.
        const assetRoot = BabylonUtils.getAssetRoot(this.container);
        assetRoot.parent = null;

        // get the original, untransformed bounding vectors from the asset.
        // IMPORTANT: only works properly when assetRoot is parented to null;
        if(boundingVectorsOut) {
            const boundingVectors = assetRoot.getHierarchyBoundingVectors();
            boundingVectorsOut.min.copyFrom(boundingVectors.min);
            boundingVectorsOut.max.copyFrom(boundingVectors.max);
        }
    
        // Instantiate.
        // Getting first root node is probably enough.
        // Note: imported glTFs are rotate because of the difference in coordinate systems.
        // Don't flip em.
        // NOTE: when an object is supposed to animate, instancing won't work.
        // NOTE: using doNotInstantiate predicate to force skinned meshes to instantiate. https://github.com/BabylonJS/Babylon.js/pull/12764
        const instance = this.container.instantiateModelsToScene(undefined, false, instantiateOptions(clone));
        assert(instance.rootNodes.length === 1, "loaded model can only have one root node");
        const instanceRoot = instance.rootNodes[0];
        instanceRoot.name = name;
        instanceRoot.parent = parent;

        // Re-root to group.
        assetRoot.parent = this.assetGroup;

        this.incRefCount();

        return instanceRoot;
    }

    public dispose() {
        this.container.dispose();
    }
}