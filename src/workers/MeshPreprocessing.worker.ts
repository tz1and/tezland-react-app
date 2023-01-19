import { preprocessMesh } from "../utils/MeshPreprocessing";
//import { initialiseWorkerStorage } from './WorkerUtils';
import { expose, Transfer } from 'threads/worker';
import { TransferDescriptor } from "threads";


//const initialise = async () => {
//    await initialiseWorkerStorage();
//}

async function preprocessMeshTransfer(buffer: TransferDescriptor<ArrayBuffer>, mime_type:
    string, maxTexRes: number): Promise<TransferDescriptor<Uint8Array>>
{
    const res = await preprocessMesh(buffer.send, mime_type, maxTexRes);
    return Transfer(res.buffer);
}

export const MeshPreprocessingWorkerApi = {
    //initialise: initialise,
    preprocessMesh: preprocessMeshTransfer
}

expose(MeshPreprocessingWorkerApi);