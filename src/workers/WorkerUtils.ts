import Metadata from '../world/Metadata';

export async function initialiseWorkerStorage() {
    await Metadata.InitialiseStorage();
}