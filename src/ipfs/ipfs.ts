import Conf from '../Config';
import '@babylonjs/loaders/glTF';
import { AssetContainer, Material, Mesh, MultiMaterial, Nullable, PBRMaterial, Scene, SceneLoader, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import Metadata from '../world/Metadata';
import BigNumber from 'bignumber.js';
import { FileLike, countPolygons } from '../utils/Utils';
import { Logging } from '../utils/Logging';
import AppSettings from '../storage/AppSettings';
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

// TODO: this really shouldn't be global. Maybe a member of world?
const assetMap: Map<number, AssetContainer> = new Map();

export function disposeAssetMap() {
    assetMap.forEach(v => {
        v.dispose();
    })
    assetMap.clear();
}

export async function download_item(token_id: BigNumber, scene: Scene, parent: Nullable<TransformNode>): Promise<Nullable<TransformNode>> {
    // check if we have this item in the scene already.
    // Otherwise, download it.
    let asset = assetMap.get(token_id.toNumber());
    if(!asset) {
        const itemMetadata = await Metadata.getItemMetadata(token_id.toNumber());
        const itemCachedStats = await Metadata.Storage.loadObject(token_id.toNumber(), "itemPolycount");
        const polygonLimit = AppSettings.triangleLimit.value;

        // remove ipfs:// from uri. some gateways requre a / in the end.
        const hash = itemMetadata.artifactUri.slice(7) + '/';

        // early out if file size in metadata is missing.
        // NOTE: can't really be missing as default in indexer db is 34359738368.
        // but indexer may change in the future...
        if(!itemMetadata.fileSize) {
            Logging.Warn("Item " + token_id + " metadata is missing fileSize. Ignoring.");
            return null;
        }

        let fileSize = itemMetadata.fileSize;
        let polygonCount = itemMetadata.polygonCount;
        // early out if cached stats exceed limits
        if(itemCachedStats) {
            fileSize = itemCachedStats.fileSize;
            polygonCount = itemCachedStats.polygonCount;

            // early out if the cached fileSize is > sizeLimit.
            if(itemCachedStats.fileSize > AppSettings.fileSizeLimit.value) {
                Logging.Warn("Item " + token_id + " exceeds size limits. Ignoring.");
                return null;
            }

            // early out if the cached polycount is > -1 and >= polygonLimit.
            if(itemCachedStats.polygonCount >= 0 && itemCachedStats.polygonCount >= polygonLimit) {
                Logging.Warn("Item " + token_id + " has too many polygons. Ignoring.");
                return null;
            }
        }
        // NOTE: while we can't do head requests to a gateway, rely on the item metadata.
        else {
            // early out if the file size from metadata is > sizeLimit.
            if(fileSize > AppSettings.fileSizeLimit.value) {
                Logging.Warn("Item " + token_id + " exceeds size limits. Ignoring.");
                return null;
            }

            // early out if the polygon count from metadata is > polygonLimit.
            if(polygonCount > polygonLimit) {
                Logging.Warn("Item " + token_id + " has too many polygons. Ignoring.");
                return null;
            }
        }
        // If no cached stats, get file size from url
        // TODO: cloudfalre ipfs gateway doesn't like this
        /*else {
            // Item metadata may be lying. Lets make sure.
            fileSize = await getUrlFileSizeHead(Conf.ipfs_gateway + '/ipfs/' + hash);
            if(fileSize > AppSettings.getFileSizeLimit()) {
                Metadata.Storage.saveObject(token_id.toNumber(), "itemPolycount", {polygonCount: -1, fileSize: fileSize});
                Logging.Warn("Item " + token_id + " file exceeds size limits. Ignoring.");
                return null;
            }
        }*/

        const mime_type = itemMetadata.mimeType;

        let plugin_ext;
        if (mime_type === "model/gltf-binary")
            plugin_ext = ".glb";
        else if (mime_type === "model/gltf+json")
            plugin_ext = ".gltf";
        else throw new Error("Unsupported mimeType");

        // TODO: download file, then load, could be better for babylon cache?
        // Because then it wouldn't contain the ipfs gateway url. That might change.

        // LoadAssetContainer?
        const result = await SceneLoader.LoadAssetContainerAsync(Conf.ipfs_gateway + '/ipfs/', hash, scene, null, plugin_ext);
        assetMap.set(token_id.toNumber(), result);

        // remove all lights and cameras.
        result.lights.forEach((l) => { l.dispose() });
        result.cameras.forEach((c) => { c.dispose() });

        const removeRefraction = (materials: Nullable<Material>[]) => {
            materials.forEach((m) => {
                if(m) {
                    if (m instanceof PBRMaterial || m instanceof StandardMaterial) {
                        const mat = m as PBRMaterial | StandardMaterial;
                        if (mat.refractionTexture) {
                            mat.refractionTexture.dispose();
                            mat.refractionTexture = null;
                        }
                        // remove relfection texture?
                        //pbr.reflectionTexture = null;
                    } else if (m instanceof MultiMaterial) {
                        const multi = m as MultiMaterial;
                        if(multi.subMaterials)
                            removeRefraction(multi.subMaterials);
                    }

                    /*if (m.getRenderTargetTextures)
                    m.getRenderTargetTextures().forEach((rtt: RenderTargetTexture) => {
                        rtt.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
                        console.log("set rtt refresh")
                    });*/
                }
            });
        };

        removeRefraction(result.materials);

        // Enabled collision on all meshes.
        result.meshes.forEach((m) => {
            m.checkCollisions = true;
            //m.useOctreeForCollisions = true; // needed?
            //m.useOctreeForPicking = true; // needed?
        })
        // Make sure to stop all animations.
        result.animationGroups.forEach((ag) => { ag.stop(); })
        asset = result;

        // If we don't have a cache, calculate polycount and store it.
        // NOTE: we cound polygons even if we have a count in the metadata, metadata could be lying.
        // TODO: this might not be good enough, since animated meshes don't have polygons?
        // Could be a babylon beta bug.
        if(itemCachedStats === null || itemCachedStats.polygonCount < 0) {
            const polycount = countPolygons(result.meshes);
            Metadata.Storage.saveObject(token_id.toNumber(), "itemPolycount", {polygonCount: polycount, fileSize: fileSize});

            if(polycount >= polygonLimit) {
                Logging.Warn("Item " + token_id + " has too many polygons. Ignoring.");

                // remove from asset map and dispose.
                assetMap.delete(token_id.toNumber());
                result.dispose();

                return null;
            }
        }

        // Normalise scale to base scale (1m by default).
        // NOTE: use result.meshes[0] instead of transformNodes
        // NOTE: could use normalizeToUnitCube, but that doesn't let us scale freely.
        const baseScale = itemMetadata.baseScale; // in m
        const {min, max} = result.meshes[0].getHierarchyBoundingVectors(true);
        const extent = max.subtract(min);
        const extent_max = Math.max(Math.max(extent.x, extent.y), extent.z);
        const new_scale = baseScale / extent_max; // Scale to 1 meters, the default.
        result.meshes[0].scaling.multiplyInPlace(new Vector3(new_scale, new_scale, new_scale));
    }
    //else Logging.InfoDev("mesh found in cache");
    
    // Parent for our instance.
    const rootNode = new Mesh(`item${token_id}`, scene, parent);

    // Instantiate.
    // Getting first root node is probably enough.
    // Note: imported glTFs are rotate because of the difference in coordinate systems.
    // Don't flip em.
    const instance = asset.instantiateModelsToScene();
    instance.rootNodes[0].name = `item${token_id}_clone`;
    instance.rootNodes[0].parent = rootNode;

    return rootNode;
}

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
