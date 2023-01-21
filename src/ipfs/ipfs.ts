import Conf from '../Config';
import { FileLike, RefLike } from '../utils/Utils';
import assert from 'assert';
import { FrameParams } from '../utils/FrameImage';


type MetadataRoyalties = {
    decimals: number;
    shares: { [key: string]: number };
}

type MetadataFormatDimensions = {
    value: string;
    unit: string;
}

interface MetadataFormat {
    uri: RefLike;
    mimeType: string;
    fileName: string;
    fileSize?: number;
    dimensions?: MetadataFormatDimensions | undefined;
}

interface BaseMetadata {
    description: string;
    minter: string;
    name: string;
}

interface TokenMetadata extends BaseMetadata {
    isTransferable: boolean;
    isBooleanAmount: boolean;
    shouldPreferSymbol: boolean;
    symbol: string;
    decimals: number;
}

export interface ItemMetadata extends TokenMetadata {
    artifactUri: FileLike;
    displayUri: FileLike;
    thumbnailUri: FileLike;
    tags: string[];
    formats: MetadataFormat[];
    baseScale: number;
    polygonCount: number;
    date: string; // Date toISOString()
    royalties: MetadataRoyalties;
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

export interface PlaceMetadata extends TokenMetadata {
    centerCoordinates: number[];
    borderCoordinates: number[][];
    buildHeight: number;
    placeType: "exterior" | "interior";
    royalties: MetadataRoyalties;
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

export interface CollectionMetadata extends BaseMetadata {
    userDescription: string;
    tags: string[];
    date: string; // Date toISOString()
    // other contract metadata
    interfaces: string[];
    version: string;
    authors: string[];
    homepage: string;
    source: any;
    license: any,
    permissions: any;
}