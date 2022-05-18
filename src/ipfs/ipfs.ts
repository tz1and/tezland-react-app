import Conf from '../Config';
import '@babylonjs/loaders/glTF';
import { FileLike } from '../utils/Utils';
import assert from 'assert';

/*const ipfs_client = ipfs.create({ url: Conf.ipfs_gateway });

export async function get_file_size(cid: string): Promise<number> {
    try {
        // @deprecated find a better library and use: dag stat <CID>
        // also, possibly need to get file from dir.
        const stat = await ipfs_client.object.stat(ipfs.CID.parse(cid));
        return stat.CumulativeSize;
    } catch(e: any) {
        Logging.Warn("Failed to get file size: " + e.message);
        return 0; // TODO: assume large or small? or throw?
    }
}*/

type ItemMetadata = {
    description: string;
    minter: string;
    name: string;
    artifactUri: FileLike;
    displayUri: FileLike;
    thumbnailUri: FileLike;
    tags: string; // unprocessed tags
    formats: object[];
    baseScale: number;
    polygonCount: number;
    date: Date;
}

export function createItemTokenMetadata(metadata: ItemMetadata): string {
    // Process tags, trim, remove empty, etc.
    const tags_processed = new Array<string>();
    metadata.tags.split(';').forEach(tag => {
        const trimmed = tag.trim();
        if(trimmed.length > 0) tags_processed.push(trimmed);
    });
    
    return JSON.stringify({
        name: metadata.name,
        description: metadata.description,
        tags: tags_processed,
        minter: metadata.minter,
        isTransferable: true,
        isBooleanAmount: false,
        shouldPreferSymbol: false,
        symbol: 'tz1and Item',
        artifactUri: metadata.artifactUri,
        displayUri: metadata.displayUri,
        thumbnailUri: metadata.thumbnailUri,
        decimals: 0,
        formats: metadata.formats,
        baseScale: metadata.baseScale,
        polygonCount: metadata.polygonCount,
        date: metadata.date.toISOString()
    });
}

type PlaceMetadata = {
    centerCoordinates?: number[];
    borderCoordinates?: number[][];
    buildHeight?: number;
    description: string;
    minter: string;
    name: string;
    placeType: "exterior" | "interior";
}

export function createPlaceTokenMetadata(metadata: PlaceMetadata) {
    const full_metadata: any = {
        name: metadata.name,
        description: metadata.description,
        minter: metadata.minter,
        isTransferable: true,
        isBooleanAmount: true,
        shouldPreferSymbol: false,
        symbol: 'tz1and Place',
        //artifactUri: cid,
        decimals: 0,
        placeType: metadata.placeType
    }

    if (metadata.placeType === "exterior") {
        assert(metadata.borderCoordinates);
        assert(metadata.centerCoordinates);
        assert(metadata.buildHeight);
        full_metadata.centerCoordinates = metadata.centerCoordinates;
        full_metadata.borderCoordinates = metadata.borderCoordinates;
        full_metadata.buildHeight = metadata.buildHeight;
    }
    
    return JSON.stringify(full_metadata);
}

export async function upload_places(places: string[]): Promise<string[]> {
    const uploaded_place_metadata: string[] = []

    // do batches of 20 or so
    var count = 0;
    var promises: Promise<Response>[] = []

    const resolvePromises = async() => {
        const responses = await Promise.all(promises);

        for (const r of responses) {
            const data = await r.json();

            if(data.error) {
                throw new Error("Upload failed: " + data.error);
            }
            else if (data.metdata_uri && data.cid) {
                uploaded_place_metadata.push(data.metdata_uri);
            }
            else throw new Error("Backend: malformed response");
        }

        promises = [];
    }

    for(const metadata of places) {
        // Post here and wait for result
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: metadata
        };
        promises.push(fetch(Conf.backend_url + "/upload", requestOptions));

        if(count >= 20) {
            await resolvePromises();
            count = 0;
        }

        count++;
    }

    await resolvePromises();

    assert(promises.length === 0);
    assert(places.length === uploaded_place_metadata.length);

    return uploaded_place_metadata;
}
