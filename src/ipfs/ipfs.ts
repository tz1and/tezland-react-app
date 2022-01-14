import axios from 'axios';
import * as ipfs from 'ipfs-http-client';
import Conf from '../Config';
import '@babylonjs/loaders/glTF';
import { Mesh, Nullable, Scene, SceneLoader, TransformNode } from '@babylonjs/core';

const ipfs_client = ipfs.create({ url: Conf.ipfs_url });

export async function download_item(item_id: number, scene: Scene, parent: Nullable<TransformNode>): Promise<Nullable<TransformNode>> {
    // check if we have this item in the scene already.
    // Otherwise, download it.
    var mesh = scene.getMeshByName(`item${item_id}`);
    if(!mesh) {
        const responseP = await axios.get(`${Conf.bcd_url}/v1/tokens/${Conf.tezos_network}/metadata?contract=${Conf.item_contract}&token_id=${item_id}`);
        const artifact = responseP.data[0].artifact_uri;

        // remove ipfs:// from uri
        const hash = artifact.slice(7);

        // LoadAssetContainer?
        const newMeshes = await SceneLoader.ImportMeshAsync('', 'http://localhost:8080/ipfs/', hash, scene, null, '.glb'); // TODO: store filetype in metadata!

        // get the root mesh
        mesh = newMeshes.meshes[0] as Mesh;
        mesh.name = `item${item_id}`;

        // then set original to be disabled
        mesh.setEnabled(false);
    }
    //else console.log("mesh found in cache");
        
    // clone
    const instance = mesh.instantiateHierarchy(parent);
    instance?.setEnabled(true);

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
}

function createItemTokenMetadata(metadata: ItemMetadata) {
    // TODO: thumbnail Uri
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
            decimals: 0
        })
    )
}

export async function upload_item_metadata(minter_address: string, name: string,
    description: string, tags: string, model_url: string, thumbnail_url: string): Promise<string> {

    // Process tags, trim, remove empty, etc.
    const tags_processed = new Array<string>();
    tags.split(';').forEach(tag => {
        const trimmed = tag.trim();
        if(trimmed.length > 0) tags_processed.push(trimmed);
    });

    // TODO: thumbnail URL

    const result = await ipfs_client.add(createItemTokenMetadata({
        name: name,
        description: description,
        minter: minter_address,
        modelUrl: model_url,
        thumbnailUrl: thumbnail_url,
        tags: tags_processed
    }));

    return `ipfs://${result.path}`;
}