import { AssetContainer, Engine, EngineOptions, Node /*, WebGPUEngine, WebGPUEngineOptions*/ } from "@babylonjs/core";
import AppSettings from "../storage/AppSettings";


namespace BabylonUtils {
    function isWebGL2Supported() {
        return !!document.createElement('canvas').getContext('webgl2');
    }

    export async function createEngine(canvas: HTMLCanvasElement) {
        let engine: Engine;
        /*const webGPUSupported = await WebGPUEngine.IsSupportedAsync;

        if (webGPUSupported) {
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
        else*/ {
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