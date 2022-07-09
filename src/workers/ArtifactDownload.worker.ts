import ArtifactDownload from '../utils/ArtifactDownload';
import { initialiseWorkerStorage } from './WorkerUtils';
import * as Comlink from 'comlink';


export const ArtifactDownloadWorkerApi = {
    initialiseWorkerStorage: initialiseWorkerStorage, 
    downloadArtifact: ArtifactDownload.downloadArtifact
}

Comlink.expose(ArtifactDownloadWorkerApi);