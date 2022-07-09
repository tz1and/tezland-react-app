import Metadata from '../world/Metadata';
import ArtifactDownload from '../utils/ArtifactDownload';
import * as Comlink from 'comlink';

async function initialiseWorkerStorage() {
    await Metadata.InitialiseStorage();
}

export const ArtifactDownloadWorkerApi = {
    initialiseWorkerStorage: initialiseWorkerStorage, 
    downloadArtifact: ArtifactDownload.downloadArtifact
}

Comlink.expose(ArtifactDownloadWorkerApi);