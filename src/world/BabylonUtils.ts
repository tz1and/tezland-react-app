import { Engine, EngineOptions /*, WebGPUEngine, WebGPUEngineOptions*/ } from "@babylonjs/core";
import AppSettings from "../storage/AppSettings";


export async function createBabylonEngine(canvas: HTMLCanvasElement) {
    let engine: Engine;
    /*const webGPUSupported = await WebGPUEngine.IsSupportedAsync;

    if (webGPUSupported) {
        const options: WebGPUEngineOptions = {
            antialiasing: AppSettings.enableAntialiasing.value,
            powerPreference: "high-performance",
            stencil: true,
            doNotHandleContextLost: true};

        const webGpuEngine = new WebGPUEngine(canvas, options);
        await webGpuEngine.initAsync();
        engine = webGpuEngine;
    }
    else*/ {
        const options: EngineOptions = {
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
            stencil: true,
            doNotHandleContextLost: true};

        engine = new Engine(canvas, AppSettings.enableAntialiasing.value, options);
    }

    engine.disableManifestCheck = true;
    return engine;
}