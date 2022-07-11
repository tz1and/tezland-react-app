import Metadata from '../world/Metadata';

export async function initialiseWorkerStorage() {
    await Metadata.InitialiseStorage();
}

export function detectInsideWebworker(): boolean {
    // run this in global scope of window or worker. since window.self = window, we're ok
    // @ts-expect-error
    if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
        return true;
    }
    return false;
}

export function getNumLogicalCores(fallback: number = 4): number {
    return navigator.hardwareConcurrency || fallback;
}