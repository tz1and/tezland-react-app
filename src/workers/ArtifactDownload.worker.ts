import ArtifactDownload from '../utils/ArtifactDownload';
import { initialiseWorkerStorage } from './WorkerUtils';
import * as Comlink from 'comlink';
import BigNumber from 'bignumber.js';


const workerStorageInitialised = initialiseWorkerStorage();

const downloadArtifact: (typeof ArtifactDownload.downloadArtifact) = async (token_id: BigNumber, sizeLimit: number, polygonLimit: number, randomGateway?: boolean) => {
    await workerStorageInitialised;

    Object.setPrototypeOf(token_id, BigNumber.prototype);
    return ArtifactDownload.downloadArtifact(token_id, sizeLimit, polygonLimit, randomGateway);
}

export const ArtifactDownloadWorkerApi = {
    downloadArtifact: downloadArtifact
}

Comlink.expose(ArtifactDownloadWorkerApi);