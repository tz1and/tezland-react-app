import ArtifactDownload, { GatewayType } from '../utils/ArtifactDownload';
import { MeshPreprocessingWorkerApi } from './MeshPreprocessing.worker';
import { getNumLogicalCores } from './WorkerUtils';
import BigNumber from 'bignumber.js';
import { expose, Transfer } from 'threads/worker';
import { spawn, Pool, TransferDescriptor, ModuleThread } from "threads"
import { Logging } from '../utils/Logging';
import TokenKey from '../utils/TokenKey';
import Metadata, { BufferFileWithMetadata } from '../world/Metadata';


async function initialiseWorkerStorage() {
    await Metadata.InitialiseStorage();
}

function shutdownWorkerStorage() {
    Metadata.ShutdownStorage();
}

export type PreprocessWorkerPoolType = Pool<ModuleThread<typeof MeshPreprocessingWorkerApi>>;

var pool: PreprocessWorkerPoolType;

const downloadArtifactTransfer = async (token_key: TokenKey, sizeLimit: number, polygonLimit: number, maxTexRes:
    number, gatwayType: GatewayType = GatewayType.Native): Promise<TransferDescriptor<BufferFileWithMetadata>> =>
{
    Object.setPrototypeOf(token_key.id, BigNumber.prototype);
    const res = await ArtifactDownload.downloadArtifact(token_key, sizeLimit, polygonLimit, maxTexRes, gatwayType, pool);
    return Transfer(res, [res.file.buffer]);
}

const initialise = async () => {
    pool = Pool(() => spawn<typeof MeshPreprocessingWorkerApi>(
        new Worker(new URL("./MeshPreprocessing.worker.ts", import.meta.url),
            { type: 'module', name: "MeshPreprocessing.worker" }), {
                timeout: 20000
            }),
        // At least two, but at most 8 threads.
        // Note: Pool.terminate chashes chromium if there are 16 threads.
        {
            size: Math.max(2, Math.min(8, getNumLogicalCores())),
            concurrency: 1 // async
        });
    await initialiseWorkerStorage();
}

const shutdown = async () => {
    Logging.InfoDev("Terminating pool: MeshPreprocessing.worker");
    // Note: Don't force shutdown threads.
    // There apprears to be some bug terminating the thread pool with force = true.
    await pool.settled(true);
    shutdownWorkerStorage();
    return pool.terminate(false);
}

export const ArtifactDownloadWorkerApi = {
    initialise: initialise,
    downloadArtifact: downloadArtifactTransfer,
    shutdown: shutdown
}

expose(ArtifactDownloadWorkerApi);