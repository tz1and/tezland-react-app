import BigNumber from "bignumber.js";
import AppSettings from "../storage/AppSettings";
import Metadata from "../world/Metadata";
//import { Logging } from "./Logging";
import Conf from "../Config";
import { DatabaseStorage } from "../storage/DatabaseStorage";
import pRetry, { AbortError } from "p-retry";
import { Logging } from "./Logging";

export type FileWithMetadata = {
    file: File;
    metadata: any;
}

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

export default class ArtifactDownload {
    public static async downloadArtifact(token_id: BigNumber): Promise<FileWithMetadata> {
        const itemMetadata = await Metadata.getItemMetadata(token_id.toNumber());

        const polygonLimit = AppSettings.triangleLimit.value;

        // remove ipfs:// from uri. some gateways requre a / in the end.
        const hash = itemMetadata.artifactUri.slice(7) + '/';
    
        const artifact_format = itemMetadata.formats.find((e: any) => e.uri === itemMetadata.artifactUri);
        if (!artifact_format) throw new Error('Artifact format not found');

        // early out if file size in artifact format is missing.
        if(!artifact_format.fileSize) {
            throw new Error("Item " + token_id + " metadata is missing fileSize. Ignoring.");
        }

        let fileSize = artifact_format.fileSize;
        let polygonCount = itemMetadata.polygonCount;
        // early out if the file size from metadata is > sizeLimit.
        if(fileSize > AppSettings.fileSizeLimit.value) {
            throw new Error("Item " + token_id + " exceeds size limits. Ignoring.");
        }

        // early out if the polygon count from metadata is > polygonLimit.
        if(polygonCount > polygonLimit) {
            throw new Error("Item " + token_id + " has too many polygons. Ignoring.");
        }

        const mime_type = artifact_format.mimeType;

        let cachedBuf = await this.loadFromDBCache(itemMetadata.artifactUri)
        if(!cachedBuf) {
            cachedBuf = await pRetry(async () => {
                // Timeout after 10 seconds.
                // Disable cache, we cache in the indexed db.
                // TODO: check if indexed db is available for cache disable?
                const response = await fetchWithTimeout(Conf.randomIpfsGateway() + '/ipfs/' + hash, 10000, { cache: "no-store" });
      
                // Abort retrying if the resource doesn't exist
                if (response.status === 404)
                    throw new AbortError(response.statusText);

                return response.arrayBuffer();
            }, {
                retries: 5,
                onFailedAttempt: error => {
                    Logging.InfoDev("Retrying:", hash);
                }
            })

            this.saveToDBCache(itemMetadata.artifactUri, cachedBuf);
        }
        //else Logging.Info("got artifact from db cache", itemMetadata.artifactUri)

        return { file: new File([cachedBuf], itemMetadata.artifactUri, {type: mime_type }), metadata: itemMetadata };
    }

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
