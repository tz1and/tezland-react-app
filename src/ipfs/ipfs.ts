import Conf from '../Config';
import '@babylonjs/loaders/glTF';
import { Mesh, Nullable, Scene, SceneLoader, TransformNode } from '@babylonjs/core';
import Metadata from '../world/Metadata';
import BigNumber from 'bignumber.js';
import { BlobLike, countPolygons } from '../utils/Utils';
import { Logging } from '../utils/Logging';
import AppSettings from '../storage/AppSettings';

export async function download_item(item_id: BigNumber, scene: Scene, parent: Nullable<TransformNode>): Promise<Nullable<TransformNode>> {
    // check if we have this item in the scene already.
    // Otherwise, download it.
    var mesh = scene.getMeshByName(`item${item_id}`);
    if(!mesh) {
        const itemMetadata = await Metadata.getItemMetadata(item_id.toNumber());
        const itemCachedPolycount = await Metadata.Storage.loadObject(item_id.toNumber(), "itemPolycount");
        const polygonLimit = AppSettings.getPolygonLimit();

        // early out if we have a cached polycount
        if(itemCachedPolycount !== null && itemCachedPolycount >= polygonLimit) {
            Logging.Warn("Item " + item_id + " has too many polygons. Ignoring.");
            return null;
        }

        // remove ipfs:// from uri
        const hash = itemMetadata.artifact_uri.slice(7);
        const mime_type = itemMetadata.formats[0].mimeType;

        let plugin_ext;
        if (mime_type === "model/gltf-binary")
            plugin_ext = ".glb";
        else if (mime_type === "model/gltf+json")
            plugin_ext = ".gltf";
        else throw new Error("Unsupported mimeType");

        // LoadAssetContainer?
        // TODO: figure out the proper way to stop animations.
        const newMeshes = await SceneLoader.ImportMeshAsync('', Conf.ipfs_gateway + '/ipfs/', hash, scene, null, plugin_ext);

        /*newMeshes.skeletons.forEach((sk) => {
            scene.removeSkeleton(sk);
            sk.dispose();
        })

        newMeshes.animationGroups.forEach((ag) => {
            scene.removeAnimationGroup(ag);
            ag.dispose();
        })*/

        // get the root mesh
        mesh = newMeshes.meshes[0] as Mesh;
        mesh.name = `item${item_id}`;

        // then set original to be disabled
        mesh.parent = scene.getTransformNodeByName("loadedItemCache");
        //mesh.setEnabled(false); // not needed, as loadedItemCache is disabled.

        // If we don't have a cache, calculate polycount and store it.
        // TODO: this might not be good enough, since animated meshes don't have polygons?
        // Could be a babylon beta bug.
        if(itemCachedPolycount === null) {
            const polycount = countPolygons(newMeshes.meshes);
            Metadata.Storage.saveObject(item_id.toNumber(), "itemPolycount", polycount);

            if(polycount >= polygonLimit) {
                Logging.Warn("Item " + item_id + " has too many polygons. Ignoring.");

                // clean up. seems a bit extreme, but whatevs.
                for (const x of newMeshes.animationGroups) x.dispose();
                for (const x of newMeshes.geometries) x.dispose();
                for (const x of newMeshes.lights) x.dispose();
                for (const x of newMeshes.meshes) x.dispose();
                for (const x of newMeshes.particleSystems) x.dispose();
                for (const x of newMeshes.skeletons) x.dispose();
                for (const x of newMeshes.transformNodes) x.dispose();

                return null;
            }
        }
    }
    //else console.log("mesh found in cache");
        
    // clone
    const instance = mesh.instantiateHierarchy(parent);
    if(instance) {
        instance.setEnabled(true);
        // for some reason instantiateHierarchy ignores setting the parent if null.
        if(parent === null) instance.parent = null;
    }

    //const loader = new GLTFFileLoader();
    //loader.loadFile(null, `http://localhost:8080/ipfs/${hash}`);

    //http://localhost:8080/ipfs/QmbVJzhKrruQx2PVyBKdfhrGFe6aD6aDFMyxoZ8aKHP1UP

    /*const arrayBuffer = await download_file(artifact);
    arrayBuffer.
    const loader = new GLTFFileLoader();
    let file = new File([arrayBuffer.], "Astronaut.glb")
    loader.loadFile()*/

    return instance;
}

type ItemMetadata = {
    description: string;
    minter: string;
    name: string;
    artifactUri: BlobLike;
    thumbnailUri: BlobLike;
    tags: string; // unprocessed tags
    formats: object[];
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
        symbol: 'Item',
        artifactUri: metadata.artifactUri,
        thumbnailUri: metadata.thumbnailUri,
        decimals: 0,
        formats: metadata.formats
    });
}

type PlaceMetadata = {
    center_coordinates: number[];
    border_coordinates: number[][];
    description: string;
    minter: string;
    name: string;
}

export function createPlaceTokenMetadata(metadata: PlaceMetadata): string {
    return JSON.stringify({
        name: metadata.name,
        description: metadata.description,
        minter: metadata.minter,
        isTransferable: true,
        isBooleanAmount: true,
        shouldPreferSymbol: true,
        symbol: 'Place',
        //artifactUri: cid,
        decimals: 0,
        center_coordinates: metadata.center_coordinates,
        border_coordinates: metadata.border_coordinates
    })
}

export async function upload_places(places: string[]): Promise<string[]> {
    const uploaded_place_metadata: string[] = []

    // do batches of 20 or so
    var count = 0;
    var promises: Promise<Response>[] = []
    for(const metadata of places) {
        // Post here and wait for result
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: metadata
        };
        promises.push(fetch(Conf.backend_url + "/upload", requestOptions));

        if(count >= 20) {
            const responses = await Promise.all(promises);

            for (const r of responses) {
                const data = await r.json();

                if(data.error) {
                    throw new Error("Upload failed: " + data.error);
                }
                else if (data.metdata_uri) {
                    uploaded_place_metadata.push(data.metdata_uri);
                }
                else throw new Error("Backend: malformed response");
            }

            promises = [];
            count = 0;
        }

        count++;
    }

    return uploaded_place_metadata;
}
