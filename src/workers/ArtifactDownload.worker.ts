import ArtifactDownload, { GatewayType } from '../utils/ArtifactDownload';
import { MeshPreprocessingWorkerApi } from './MeshPreprocessing.worker';
import { initialiseWorkerStorage, getNumLogicalCores } from './WorkerUtils';
import BigNumber from 'bignumber.js';
import { expose } from 'threads/worker';
import { spawn, Pool } from "threads"
import { Logging } from '../utils/Logging';
import TokenKey from '../utils/TokenKey';


const pool = Pool(
    () => spawn<typeof MeshPreprocessingWorkerApi>(
        new Worker(new URL("./MeshPreprocessing.worker.ts", import.meta.url),
        { name: "MeshPreprocessing.worker" })),
    // At least two, but at most 8 threads.
    // Note: Pool.terminate chashes chromium if there are 16 threads.
    Math.max(2, Math.min(8, getNumLogicalCores())));

const downloadArtifact: (typeof ArtifactDownload.downloadArtifact) = async (
    token_key: TokenKey, sizeLimit: number, polygonLimit: number, maxTexRes:
    number, gatwayType: GatewayType = GatewayType.Native) => {
    Object.setPrototypeOf(token_key.id, BigNumber.prototype);
    return ArtifactDownload.downloadArtifact(token_key, sizeLimit, polygonLimit, maxTexRes, gatwayType, pool);
}

const initialise = async () => {
    await initialiseWorkerStorage();
}

const shutdown = async () => {
    Logging.InfoDev("Terminating pool: MeshPreprocessing.worker");
    return pool.terminate(true);
}

export const ArtifactDownloadWorkerApi = {
    initialise: initialise,
    downloadArtifact: downloadArtifact,
    shutdown: shutdown
}

expose(ArtifactDownloadWorkerApi);