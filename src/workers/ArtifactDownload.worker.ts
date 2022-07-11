import ArtifactDownload from '../utils/ArtifactDownload';
import { MeshPreprocessingWorkerApi } from './MeshPreprocessing.worker';
import { initialiseWorkerStorage, getNumLogicalCores } from './WorkerUtils';
import BigNumber from 'bignumber.js';
import { expose } from 'threads/worker';
import { spawn, Pool } from "threads"
import { Logging } from '../utils/Logging';


const pool = Pool(
    () => spawn<typeof MeshPreprocessingWorkerApi>(
        new Worker(new URL("./MeshPreprocessing.worker.ts", import.meta.url),
        { name: "MeshPreprocessing.worker" })),
    getNumLogicalCores());

const downloadArtifact: (typeof ArtifactDownload.downloadArtifact) = async (
    token_id: BigNumber, sizeLimit: number, polygonLimit: number, maxTexRes:
    number, randomGateway?: boolean) => {
    Object.setPrototypeOf(token_id, BigNumber.prototype);
    return ArtifactDownload.downloadArtifact(token_id, sizeLimit, polygonLimit, maxTexRes, randomGateway, pool);
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