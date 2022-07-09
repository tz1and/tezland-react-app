import { preprocessMesh } from "../utils/MeshPreprocessing";
//import { initialiseWorkerStorage } from './WorkerUtils';
import { expose } from 'threads/worker';


//const initialise = async () => {
//    await initialiseWorkerStorage();
//}

export const MeshPreprocessingWorkerApi = {
    //initialise: initialise,
    preprocessMesh: preprocessMesh
}

expose(MeshPreprocessingWorkerApi);