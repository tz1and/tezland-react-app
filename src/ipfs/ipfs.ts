import * as ipfs from 'ipfs-http-client';
import Conf from '../Config';
import '@babylonjs/loaders/glTF';
import { Mesh, Nullable, Scene, SceneLoader, TransformNode } from '@babylonjs/core';
import Metadata from '../world/Metadata';
import BigNumber from 'bignumber.js';
import { countPolygons } from '../utils/Utils';
import { Logging } from '../utils/Logging';

const ipfs_client = ipfs.create({ url: Conf.ipfs_url });

export async function download_item(item_id: BigNumber, scene: Scene, parent: Nullable<TransformNode>): Promise<Nullable<TransformNode>> {
    // check if we have this item in the scene already.
    // Otherwise, download it.
    var mesh = scene.getMeshByName(`item${item_id}`);
    if(!mesh) {
        const itemMetadata = await Metadata.getItemMetadata(item_id.toNumber());
        const itemCachedPolycount = await Metadata.Storage.loadObject(item_id.toNumber(), "itemPolycount");

        // early out if we have a cached polycount
        console.log(Conf.polycount_limit);
        if(itemCachedPolycount !== null && itemCachedPolycount >= Conf.polycount_limit) {
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
        const newMeshes = await SceneLoader.ImportMeshAsync('', 'http://localhost:8080/ipfs/', hash, scene, null, plugin_ext);

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

            if(polycount >= Conf.polycount_limit) {
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

export async function download_file(url: string) {
    return ipfs_client.get(url);
}

export async function upload_model(buffer: ArrayBuffer): Promise<string> {
    const result = await ipfs_client.add(buffer);

    return `ipfs://${result.path}`;
}

export async function upload_thumbnail(blob: Blob): Promise<string> {
    const result = await ipfs_client.add(blob);

    return `ipfs://${result.path}`;
}

interface ItemMetadata {
    description: string;
    minter: string;
    name: string;
    modelUrl: string;
    thumbnailUrl: string;
    tags: string[];
    formats: object[];
}

function createItemTokenMetadata(metadata: ItemMetadata) {
    // TODO: creators
    
    return Buffer.from(
        JSON.stringify({
            name: metadata.name,
            description: metadata.description,
            tags: metadata.tags,
            minter: metadata.minter,
            isTransferable: true,
            isBooleanAmount: false,
            shouldPreferSymbol: false,
            symbol: 'Item',
            artifactUri: metadata.modelUrl,
            thumbnailUri: metadata.thumbnailUrl,
            decimals: 0,
            formats: metadata.formats
        })
    )
}

export async function upload_item_metadata(minter_address: string, name: string,
    description: string, tags: string, model_url: string, thumbnail_url: string, mime_type: string): Promise<string> {

    // Process tags, trim, remove empty, etc.
    const tags_processed = new Array<string>();
    tags.split(';').forEach(tag => {
        const trimmed = tag.trim();
        if(trimmed.length > 0) tags_processed.push(trimmed);
    });

    const result = await ipfs_client.add(createItemTokenMetadata({
        name: name,
        description: description,
        minter: minter_address,
        modelUrl: model_url,
        thumbnailUrl: thumbnail_url,
        tags: tags_processed,
        formats: [
            {
                mimeType: mime_type,
                uri: model_url
            }
        ]
    }));

    return `ipfs://${result.path}`;
}

interface PlaceMetadata {
    center_coordinates: number[];
    border_coordinates: number[][];
    description: string;
    minter: string;
    name: string;
}

export function createPlaceTokenMetadata(metadata: PlaceMetadata) {
    return Buffer.from(
        JSON.stringify({
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
    )
}

export async function upload_places(places: Buffer[]): Promise<string[]> {
    const files = [];
    for(const file of places) { files.push({content: file}); }

    const addedFiles: string[] = [];
    for await (const upload of ipfs_client.addAll(files/*, { progress: (prog) => console.log(`received: ${prog}`) }*/)) {
        addedFiles.push(`ipfs://${upload.path}`);
    }

    return addedFiles;
}

/*export async function upload_place_metadata(minter_address: string, center: number[], border: number[][]): Promise<string> {
    const result = await ipfs_client.add(createPlaceTokenMetadata({
        identifier: "some-uuid",
        description: "A nice place",
        minter: minter_address,
        center_coordinates: center,
        border_coordinates: border
    }));

    return `ipfs://${result.path}`;
}*/