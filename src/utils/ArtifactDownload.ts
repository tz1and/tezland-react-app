import Metadata, { BufferFile, BufferFileWithMetadata, ItemTokenMetadata } from "../world/Metadata";
//import { Logging } from "./Logging";
import Conf from "../Config";
import { DatabaseStorage } from "../storage/DatabaseStorage";
import pRetry, { AbortError } from "p-retry";
import { Logging } from "./Logging";
import { preprocessMesh } from "./MeshPreprocessing";
import { PreprocessWorkerPoolType } from "../workers/ArtifactDownload.worker";
import { Transfer } from 'threads/worker';
import TokenKey from "./TokenKey";
import { isImageFileType } from "./Utils";
import { assert } from "./Assert";


async function fetchWithTimeout(input: RequestInfo, timeout: number, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
}

function decodeSplitEncodeURI(uri: string) {
    const split = decodeURI(uri).split('/');
    const encodedParts = split.map((e) => { 
        return encodeURIComponent(e);
    });
    return encodedParts.join('/');
}

export const enum GatewayType {
    Native = 0,
    RandomPublic
}

export default class ArtifactDownload {
    public static async downloadArtifact(
        token_key: TokenKey, sizeLimit: number, polygonLimit: number, maxTexRes: number,
        gatewayType: GatewayType = GatewayType.Native, pool?: PreprocessWorkerPoolType): Promise<BufferFileWithMetadata> {
        const itemMetadata = await Metadata.getItemMetadata(token_key.id.toNumber(), token_key.fa2);
        assert(itemMetadata);

        // remove ipfs:// from uri. some gateways requre a / in the end.
        const hash = decodeSplitEncodeURI(itemMetadata.artifactUri.slice(7)) + '/';

        let fileSize = itemMetadata.fileSize;
        let polygonCount = itemMetadata.polygonCount;
        // early out if the file size from metadata is > sizeLimit.
        if(fileSize > sizeLimit) {
            throw new Error(`Item ${token_key.id} exceeds size limits (${fileSize} > ${sizeLimit}).`);
        }

        // early out if the polygon count from metadata is > polygonLimit.
        if(polygonCount > polygonLimit) {
            throw new Error(`Item ${token_key.id} exceeds triangle limits (${polygonCount} > ${polygonLimit}).`);
        }

        const mime_type = itemMetadata.mimeType;

        //if (detectInsideWebworker()) Logging.InfoDev("Loading in webworker: " + itemMetadata.artifactUri);

        let cachedBuf = await ArtifactDownload.loadFromDBCache(itemMetadata.artifactUri)
        if(!cachedBuf) {
            cachedBuf = await pRetry(async () => {
                // Timeout after 10 seconds.
                // Disable cache, we cache in the indexed db.
                // TODO: check if indexed db is available for cache disable?
                const gateway = gatewayType === GatewayType.RandomPublic ? Conf.randomPublicIpfsGateway() : Conf.ipfs_native_gateway;
                const response = await fetchWithTimeout(gateway + '/ipfs/' + hash, 30000, { cache: "no-store" });

                // Abort retrying if the resource doesn't exist.
                if (response.status === 404) throw new AbortError(response.statusText);

                if (!response.ok) throw new Error("Fetch failed: " + response.statusText);

                const buffer = await response.arrayBuffer();

                // Indexer validates file size, so we can use it to verify the download integrity.
                if (buffer.byteLength !== fileSize) throw new Error(`Download size mismatch: expected=${fileSize}, got=${buffer.byteLength}`);

                return buffer;
            }, {
                retries: 6,
                minTimeout: 2000,
                onFailedAttempt: error => {
                    Logging.InfoDev("Retrying:", hash);
                }
            })

            ArtifactDownload.saveToDBCache(itemMetadata.artifactUri, cachedBuf);
        }
        //else Logging.Info("got artifact from db cache", itemMetadata.artifactUri)

        return { file: await ArtifactDownload.preprocessMesh(cachedBuf, itemMetadata.artifactUri, mime_type, maxTexRes, pool), metadata: itemMetadata };
    }

    public static async downloadModel(baseUrl: string, fileName: string, maxTexRes: number, pool?: PreprocessWorkerPoolType): Promise<BufferFileWithMetadata> {
        // TODO: only works for binary gltf model for now.
        const mime_type =  "model/gltf-binary";

        const response = await fetch(baseUrl + fileName);
        const buf = await response.arrayBuffer();

        return { file: await ArtifactDownload.preprocessMesh(buf, fileName, mime_type, maxTexRes, pool), metadata: {baseScale: 1} as ItemTokenMetadata };
    }

    private static async preprocessMesh(buffer: ArrayBuffer, fileName: string, mime_type: string, maxTexRes: number, pool: PreprocessWorkerPoolType | undefined): Promise<BufferFile> {
        try {
            let processed: Uint8Array;
            if (pool) {
                processed = await pool.queue(moduleThread => {
                    return moduleThread.preprocessMesh(Transfer(buffer), mime_type, maxTexRes);
                })
            }
            else {
                processed = await preprocessMesh(buffer, mime_type, maxTexRes);
            }

            const new_mime_type = isImageFileType(mime_type) ? mime_type : "model/gltf-binary";

            return {buffer: processed, name: fileName, type: new_mime_type};
        }
        catch(e: any) {
            Logging.ErrorDev(`Pre-processing mesh ${fileName} failed: ${e}`);

            return {buffer: buffer, name: fileName, type: mime_type};
        }
    }

    /*public static async deleteFromDBCache(token_id: BigNumber) {
        if (Metadata.Storage instanceof DatabaseStorage) {
            const db = Metadata.Storage.db;

            const itemMetadata = await Metadata.getItemMetadata(token_id.toNumber());

            const tx = db.transaction(["artifactCache", "artifactMeta"], "readwrite", { durability: "relaxed" })

            //Promise.all([
            tx.objectStore("artifactCache").delete(itemMetadata.artifactUri);
            tx.objectStore("artifactMeta").delete(itemMetadata.artifactUri);
            //    tx.done
            //]);

            // TODO: figure out if we need to call commit.
            tx.commit();
        }
    }*/

    private static saveToDBCache(artifactUri: string, file: ArrayBuffer) {
        if (Metadata.Storage instanceof DatabaseStorage) {
            const db = Metadata.Storage.db;

            const tx = db.transaction(["artifactCache", "artifactMeta"], "readwrite", { durability: "relaxed" })

            //Promise.all([
            tx.objectStore("artifactCache").put(file, artifactUri);
            tx.objectStore("artifactMeta").put({ lastAccess: new Date(), size: file.byteLength }, artifactUri);
            //    tx.done
            //]);

            // TODO: figure out if we need to call commit.
            tx.commit();
        }
    }

    private static async loadFromDBCache(artifactUri: string): Promise<ArrayBuffer | undefined> {
        if (Metadata.Storage instanceof DatabaseStorage) {
            const db = Metadata.Storage.db;

            const tx = db.transaction(["artifactCache", "artifactMeta"], "readwrite", { durability: "relaxed" })

            const cached = await tx.objectStore("artifactCache").get(artifactUri);
            if (cached) {
                //Promise.all([
                tx.objectStore("artifactMeta").put({ lastAccess: new Date(), size: cached.byteLength }, artifactUri);
                //    tx.done
                //]);

                // TODO: figure out if we need to call commit.
                tx.commit();

                return cached;
            }

            // TODO: figure out if we need to call commit.
            tx.commit();
        }

        return undefined;
    }
}

