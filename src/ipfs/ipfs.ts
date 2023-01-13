import Conf from '../Config';
import { FileLike, RefLike } from '../utils/Utils';
import assert from 'assert';
import { FrameParams } from '../utils/FrameImage';


type Royalties = {
    decimals: number;
    shares: Map<string, number>;
}

type MetadataFormatDimensions = {
    value: string;
    unit: string;
}

type MetadataFormat = {
    uri: RefLike;
    mimeType: string;
    fileName: string;
    fileSize?: number;
    dimensions?: MetadataFormatDimensions | undefined;
}

type ItemMetadata = {
    description: string;
    minter: string;
    name: string;
    artifactUri: FileLike;
    displayUri: FileLike;
    thumbnailUri: FileLike;
    tags: string; // unprocessed tags
    formats: MetadataFormat[];
    baseScale: number;
    polygonCount: number;
    date: Date;
    royalties: Royalties;
    imageFrame?: FrameParams | undefined;
}

export function processTags(tags: string): string[] {
    // Process tags, trim, remove empty, etc.
    const tags_processed: string[] = [];
    tags.split(';').forEach(tag => {
        const trimmed = tag.trim();
        if(trimmed.length > 0) tags_processed.push(trimmed);
    });

    return tags_processed;
}

export function createItemTokenMetadata(metadata: ItemMetadata): string {
    return JSON.stringify({
        name: metadata.name,
        description: metadata.description,
        tags: processTags(metadata.tags),
        minter: metadata.minter,
        isTransferable: true,
        isBooleanAmount: false,
        shouldPreferSymbol: false,
        symbol: 'ITEM',
        artifactUri: metadata.artifactUri,
        displayUri: metadata.displayUri,
        thumbnailUri: metadata.thumbnailUri,
        decimals: 0,
        formats: metadata.formats,
        baseScale: metadata.baseScale,
        polygonCount: metadata.polygonCount,
        date: metadata.date.toISOString(),
        royalties: {
            decimals: metadata.royalties.decimals,
            shares: Object.fromEntries(metadata.royalties.shares)
        },
        imageFrame: metadata.imageFrame
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
    royalties: Royalties;
}

export function createPlaceTokenMetadata(metadata: PlaceMetadata) {
    const full_metadata: any = {
        name: metadata.name,
        description: metadata.description,
        minter: metadata.minter,
        isTransferable: true,
        isBooleanAmount: true,
        shouldPreferSymbol: false,
        symbol: 'PLACE',
        //artifactUri: cid,
        decimals: 0,
        placeType: metadata.placeType,
        royalties: {
            decimals: metadata.royalties.decimals,
            shares: Object.fromEntries(metadata.royalties.shares)
        }
    }

    // TODO!!! IMPORTANT!!!
    //if (metadata.placeType === "exterior") {
        assert(metadata.borderCoordinates);
        assert(metadata.centerCoordinates);
        assert(metadata.buildHeight);
        full_metadata.centerCoordinates = metadata.centerCoordinates;
        full_metadata.borderCoordinates = metadata.borderCoordinates;
        full_metadata.buildHeight = metadata.buildHeight;
    //}
    
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

        promises.length = 0;
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

type CollectionMetadata = {
    name: string;
    description: string;
    minter: string;
    tags: string; // unprocessed tags
    date: Date;
}

export function createCollectionMetadata(metadata: CollectionMetadata): string {
    return JSON.stringify({
        name: metadata.name,
        userDescription: metadata.description,
        minter: metadata.minter,
        tags: processTags(metadata.tags),
        date: metadata.date.toISOString(),
        // Other contract metadata:
        interfaces: [ "TZIP-012", "TZIP-016" ],
        description: "A tz1and private Item collection.\n\nBased on the SmartPy FA2 implementation.",
        version: "1.0.0",
        authors: [ "852Kerfunkle <https://github.com/852Kerfunkle>", "SmartPy <https://smartpy.io/#contact>" ],
        homepage: "https://www.tz1and.com",
        source: { "tools": [ "SmartPy" ], "location": "https://github.com/tz1and" },
        license: { "name": "MIT" },
        permissions: { "receiver": "owner-no-hook", "sender": "owner-no-hook", "operator": "pauseable-owner-or-operator-transfer" }
    });
}