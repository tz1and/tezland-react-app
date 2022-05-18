import BigNumber from "bignumber.js";
import AppSettings from "../storage/AppSettings";
import Metadata from "../world/Metadata";
//import { Logging } from "./Logging";
import fetchRetryConstructor from "fetch-retry";
import Conf from "../Config";
var fetchRetry = fetchRetryConstructor(fetch);

export type FileWithMetadata = {
    file: File;
    metadata: any;
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
    
        const res = await fetchRetry(Conf.ipfs_gateway + '/ipfs/' + hash, {
            retries: 5,
            retryDelay: function(attempt, error, response) {
              return Math.pow(2, attempt) * 1000; // 1000, 2000, 4000
            }
        });
    
        const buf = await res.arrayBuffer();
    
        return { file: new File([buf], itemMetadata.artifactUri, {type: mime_type }), metadata: itemMetadata };
    }
}
